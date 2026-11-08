import type { Session } from '../types';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
export class SessionExpiredError extends ApiError {
  constructor() {
    super('A sessão expirou. Inicia sessão novamente.', 401);
    this.name = 'SessionExpiredError';
  }
}
export interface ApiConfiguration {
  apiUrl: string;
  supabaseUrl: string;
  publishableKey: string;
}
type RequestOptions = {
  method?: string;
  body?: unknown;
  rest?: boolean;
  workspace?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export class CellApi {
  config: ApiConfiguration;
  private fetcher: typeof fetch;
  private persist: (session: Session) => Promise<void>;
  private refreshing = new Map<string, Promise<Session>>();
  private generation = 0;
  private blocked = false;
  private activeSession?: Session;
  constructor(
    config: ApiConfiguration,
    fetcher: typeof fetch = fetch,
    persist: (session: Session) => Promise<void> = async () => {},
  ) {
    this.config = config;
    this.fetcher = fetcher.bind(globalThis);
    this.persist = persist;
    for (const address of [config.apiUrl, config.supabaseUrl]) {
      const url = new URL(address);
      if (
        url.username ||
        url.password ||
        (url.protocol !== 'https:' &&
          !(
            url.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(url.hostname)
          ))
      )
        throw new Error('Configuração de API inválida.');
    }
  }
  invalidate() {
    this.generation++;
    this.blocked = true;
  }
  activate(session: Session) {
    this.activeSession = session;
    this.blocked = false;
  }

  private async json(
    url: string,
    options: RequestInit,
    signal?: AbortSignal,
    timeoutMs = 25000,
  ): Promise<any> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) throw new ApiError('Operação cancelada.');
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(abort, timeoutMs);
    try {
      const response = await this.fetcher(url, {
        ...options,
        signal: controller.signal,
        redirect: 'error',
      });
      const type = response.headers.get('content-type') || '';
      const data = type.includes('json')
        ? await response.json().catch(() => null)
        : null;
      if (!response.ok) {
        const message =
          data?.message || data?.error_description || data?.error || data?.msg;
        throw new ApiError(
          typeof message === 'string'
            ? message.slice(0, 600)
            : `O serviço devolveu um erro (${response.status}).`,
          response.status,
        );
      }
      if (data === null)
        throw new ApiError('Resposta inválida do serviço.', 502);
      return data;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (controller.signal.aborted)
        throw new ApiError(
          signal?.aborted
            ? 'Operação cancelada.'
            : 'A ligação demorou demasiado. Podes tentar novamente.',
        );
      throw new ApiError(
        'Sem ligação ao serviço. Verifica a internet e tenta novamente.',
      );
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }

  private sessionFrom(data: any, previous?: Session): Session {
    if (!data?.access_token || !data?.refresh_token || !data?.user?.id)
      throw new ApiError('Resposta de autenticação inválida.', 502);
    if (previous?.userId && previous.userId !== data.user.id)
      throw new SessionExpiredError();
    return {
      ...previous,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt:
        Number(data.expires_at) ||
        Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
      userId: data.user.id,
      email: data.user.email,
      displayName:
        data.user.user_metadata?.full_name ||
        data.user.email?.split('@')[0] ||
        'Utilizador',
    };
  }

  async signIn(email: string, password: string): Promise<Session> {
    const generation = this.generation;
    const data = await this.json(
      `${this.config.supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          apikey: this.config.publishableKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      },
    );
    if (generation !== this.generation) throw new SessionExpiredError();
    const session = this.sessionFrom(data);
    this.activate(session);
    return session;
  }

  async refresh(session: Session): Promise<void> {
    if (
      this.blocked ||
      (this.activeSession && this.activeSession.userId !== session.userId)
    )
      throw new SessionExpiredError();
    if (!session.refreshToken || !session.userId)
      throw new SessionExpiredError();
    const key = session.userId;
    let task = this.refreshing.get(key);
    if (!task) {
      const generation = this.generation;
      task = (async () => {
        let data: any;
        try {
          data = await this.json(
            `${this.config.supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
            {
              method: 'POST',
              headers: {
                apikey: this.config.publishableKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ refresh_token: session.refreshToken }),
            },
          );
        } catch (error) {
          if (
            error instanceof ApiError &&
            [400, 401, 403].includes(error.status)
          )
            throw new SessionExpiredError();
          throw error;
        }
        if (this.generation !== generation) throw new SessionExpiredError();
        const renewed = this.sessionFrom(data, session);
        Object.assign(session, renewed);
        await this.persist(session);
        return renewed;
      })();
      this.refreshing.set(key, task);
      void task
        .finally(() => {
          if (this.refreshing.get(key) === task) this.refreshing.delete(key);
        })
        .catch(() => {});
    }
    Object.assign(session, await task);
  }

  async request(
    path: string,
    session: Session,
    options: RequestOptions = {},
  ): Promise<any> {
    const generation = this.generation;
    if (
      this.blocked ||
      (this.activeSession &&
        (this.activeSession.userId !== session.userId ||
          (options.workspace !== false &&
            this.activeSession.workspaceId !== session.workspaceId)))
    )
      throw new SessionExpiredError();
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://'))
      throw new Error('Caminho de API inválido.');
    if (!session.accessToken || !session.userId)
      throw new SessionExpiredError();
    if (
      options.workspace !== false &&
      (!session.workspaceId || session.workspaceId === 'ws_default')
    )
      throw new ApiError('Seleciona um espaço de trabalho.');
    if (!session.expiresAt || session.expiresAt <= Date.now() / 1000 + 60)
      await this.refresh(session);
    const execute = async () => {
      try {
        const result = await this.json(
          (options.rest
            ? this.config.supabaseUrl + '/rest/v1'
            : this.config.apiUrl) + path,
          {
            method: options.method || 'GET',
            headers: {
              Authorization: `Bearer ${session.accessToken}`,
              'Content-Type': 'application/json',
              ...(options.rest
                ? {
                    apikey: this.config.publishableKey,
                    Prefer: 'return=representation',
                  }
                : {}),
              ...(session.workspaceId
                ? { 'x-workspace-id': session.workspaceId }
                : {}),
            },
            body:
              options.body === undefined
                ? undefined
                : JSON.stringify(options.body),
          },
          options.signal,
          options.timeoutMs,
        );
        if (generation !== this.generation) throw new SessionExpiredError();
        return result;
      } catch (error) {
        if (generation !== this.generation) throw new SessionExpiredError();
        throw error;
      }
    };
    const token = session.accessToken;
    try {
      return await execute();
    } catch (error) {
      if (
        error instanceof SessionExpiredError ||
        generation !== this.generation
      )
        throw error;
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      if (session.accessToken === token) await this.refresh(session);
      try {
        return await execute();
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401)
          throw new SessionExpiredError();
        throw retryError;
      }
    }
  }
}
