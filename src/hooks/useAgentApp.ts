import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SetStateAction,
} from 'react';
import { AppState, Linking } from 'react-native';
import { gateway } from '../services/gateway';
import { SessionExpiredError } from '../services/api';
import {
  acknowledgePending,
  conversationMessages,
  recoverUnconfirmedPending,
} from '../services/contracts';
import {
  clearCaptureFiles,
  guessMime,
  persistCapture,
  readAttachment,
} from '../services/files';
import { forgetSession, loadSession, saveSession } from '../services/session';
import type {
  Agent,
  AgentAvatarChoice,
  AgentConfig,
  AgentDraft,
  AgentGrants,
  AgentProfile,
  AgentRun,
  CaptureItem,
  CredentialVaultItem,
  FileAttachment,
  GlobalVariableItem,
  PendingMessage,
  RunOperation,
  Session,
  WorkspaceInfo,
} from '../types';

function mergeRuns(previous: AgentRun[], incoming: AgentRun[]): AgentRun[] {
  const map = new Map(previous.map((run) => [run.id, run]));
  for (const run of incoming) {
    const old = map.get(run.id);
    if (!old || !old.updatedAt || run.updatedAt >= old.updatedAt)
      map.set(run.id, run);
  }
  return [...map.values()]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-100);
}

export function useAgentApp() {
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(null),
    epoch = useRef(0);
  const [loaded, setLoaded] = useState(false),
    [loginBusy, setLoginBusy] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]),
    [agentId, setAgentId] = useState<string | null>(null);
  const agentIdRef = useRef<string | null>(null);
  agentIdRef.current = agentId;
  const [primaryId, setPrimaryId] = useState<string | null>(null),
    [showAgents, setShowAgents] = useState(false);
  const [profile, setProfile] = useState<AgentProfile | null>(null),
    [profileKnown, setProfileKnown] = useState(false);
  const [{ runs, pending }, setTranscript] = useState<{
    runs: AgentRun[];
    pending: PendingMessage[];
  }>({ runs: [], pending: [] });
  const transmissions = useRef(new Set<{ agentId: string; context: number }>());
  const transcriptRevision = useRef(0);
  const [drafts, setDrafts] = useState<Record<string, AgentDraft>>({});
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const [captures, setCaptures] = useState<CaptureItem[]>([]),
    [credentials, setCredentials] = useState<CredentialVaultItem[]>([]);
  const [variables, setVariables] = useState<GlobalVariableItem[]>([]),
    [workspaces, setWorkspaces] = useState<WorkspaceInfo[]>([]);
  const [notice, setNotice] = useState(''),
    [connectionError, setConnectionError] = useState('');
  const [sending, setSending] = useState(false),
    [controlBusy, setControlBusy] = useState<string | null>(null);
  const [foreground, setForeground] = useState(
    AppState.currentState !== 'background',
  );
  const [revision, setRevision] = useState(0);
  const scope = session ? `${session.userId}:${session.workspaceId}` : '';
  const activeAgent = agents.find((agent) => agent.id === agentId) || null;

  const isTransmitting = (id: string, context: number) =>
    [...transmissions.current].some(
      (item) => item.agentId === id && item.context === context,
    );
  const beginTransmission = (id: string, context: number) => {
    const token = { agentId: id, context };
    transmissions.current.add(token);
    transcriptRevision.current++;
    return () => {
      transmissions.current.delete(token);
      transcriptRevision.current++;
    };
  };
  const reset = () => {
    setAgents([]);
    setAgentId(null);
    setProfile(null);
    setProfileKnown(false);
    setTranscript({ runs: [], pending: [] });
    setDrafts({});
    setCredentials([]);
    setVariables([]);
    setCaptures([]);
    setWorkspaces([]);
    setSending(false);
    setControlBusy(null);
  };
  const logout = useCallback(async () => {
    const old = sessionRef.current;
    epoch.current++;
    sessionRef.current = null;
    gateway.api.invalidate();
    setSession(null);
    reset();
    setConnectionError('');
    const cleanup = await Promise.allSettled([
      forgetSession(),
      ...(old ? [gateway.clearLocalAccount(old), clearCaptureFiles(old)] : []),
    ]);
    if (cleanup.some((result) => result.status === 'rejected'))
      setNotice(
        'A sessão foi fechada nesta vista, mas a limpeza local não terminou. Tenta terminar a sessão novamente antes de partilhar este dispositivo.',
      );
  }, []);
  const fail = useCallback(
    (error: unknown, expectedEpoch: number) => {
      if (expectedEpoch !== epoch.current) return;
      if (error instanceof SessionExpiredError) {
        void logout();
        setNotice(error.message);
      } else
        setConnectionError(
          error instanceof Error
            ? error.message
            : 'Não foi possível contactar o serviço.',
        );
    },
    [logout],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const saved = await loadSession();
      if (saved) {
        await gateway.restoreSession(saved);
        if (!cancelled) {
          sessionRef.current = saved;
          setSession(saved);
        }
      }
    })()
      .catch((error) => {
        if (!cancelled)
          setNotice(
            error instanceof Error
              ? error.message
              : 'Não foi possível recuperar a sessão.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active'),
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    const auth = sessionRef.current;
    if (!auth || !scope) return;
    let cancelled = false;
    const context = epoch.current;
    const valid = () => !cancelled && epoch.current === context;
    (async () => {
      const [cached, primary] = await Promise.all([
        gateway.getCachedAgents(auth),
        gateway.getPrimaryAgent(auth),
      ]);
      if (!valid()) return;
      setPrimaryId(primary);
      if (cached.length) {
        setAgents(cached);
        setAgentId((current) =>
          cached.some((agent) => agent.id === current)
            ? current
            : cached.find((agent) => agent.id === primary)?.id || cached[0].id,
        );
      }
      const fresh = await gateway.getAgents(auth);
      if (!valid()) return;
      setAgents(fresh);
      setAgentId((current) =>
        fresh.some((agent) => agent.id === current)
          ? current
          : fresh.find((agent) => agent.id === primary)?.id ||
            fresh[0]?.id ||
            null,
      );
      setConnectionError('');
    })().catch((error) => {
      if (valid()) fail(error, context);
    });
    Promise.allSettled([
      gateway.getCredentials(auth),
      gateway.getVariables(auth),
      gateway.getWorkspaces(auth),
      gateway.getCaptures(auth),
    ]).then((results) => {
      if (!valid()) return;
      if (results[0].status === 'fulfilled') setCredentials(results[0].value);
      if (results[1].status === 'fulfilled') setVariables(results[1].value);
      if (results[2].status === 'fulfilled') setWorkspaces(results[2].value);
      if (results[3].status === 'fulfilled') setCaptures(results[3].value);
      const rejected = results.find((result) => result.status === 'rejected');
      if (rejected?.status === 'rejected') fail(rejected.reason, context);
    });
    return () => {
      cancelled = true;
    };
  }, [scope, revision, fail]);

  useEffect(() => {
    const auth = sessionRef.current;
    setProfile(null);
    setProfileKnown(false);
    setTranscript({ runs: [], pending: [] });
    if (!auth || !agentId) return;
    let cancelled = false;
    const context = epoch.current;
    const observedRevision = transcriptRevision.current;
    Promise.all([
      gateway.getCachedRuns(agentId, auth),
      gateway.getPending(agentId, auth),
    ])
      .then(([cached, outbox]) => {
        if (
          !cancelled &&
          context === epoch.current &&
          agentId === agentIdRef.current &&
          observedRevision === transcriptRevision.current
        ) {
          const transmitting = isTransmitting(agentId, context);
          setTranscript((value) => ({
            runs: transmitting ? value.runs : mergeRuns(value.runs, cached),
            pending: transmitting
              ? [
                  ...new Map(
                    [...outbox, ...value.pending].map((item) => [
                      item.id,
                      item,
                    ]),
                  ).values(),
                ]
              : recoverUnconfirmedPending(outbox),
          }));
        }
      })
      .catch((error) => {
        if (!cancelled) fail(error, context);
      });
    gateway
      .getAgentProfile(agentId, auth)
      .then((value) => {
        if (
          !cancelled &&
          context === epoch.current &&
          agentId === agentIdRef.current
        ) {
          setProfile(value);
          setProfileKnown(true);
        }
      })
      .catch((error) => {
        if (!cancelled) fail(error, context);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, scope, revision, fail]);

  useEffect(() => {
    const auth = sessionRef.current;
    if (!auth || !agentId || !foreground) return;
    const controller = new AbortController(),
      context = epoch.current;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const observedRevision = transcriptRevision.current;
      try {
        const fresh = await gateway.getRuns(agentId, auth, controller.signal),
          outbox = await gateway.getPending(agentId, auth);
        if (
          !controller.signal.aborted &&
          context === epoch.current &&
          agentId === agentIdRef.current &&
          observedRevision === transcriptRevision.current &&
          !isTransmitting(agentId, context)
        ) {
          setTranscript((value) => ({
            runs: mergeRuns(value.runs, fresh),
            pending: recoverUnconfirmedPending(outbox),
          }));
          setConnectionError('');
        }
      } catch (error) {
        if (!controller.signal.aborted) fail(error, context);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 4000);
      }
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [agentId, scope, foreground, revision, fail]);

  const queuedId = runs.find(
    (run) =>
      run.workflowId === agentId &&
      run.status === 'queued' &&
      (!run.retryAt || Date.parse(run.retryAt) <= Date.now()),
  )?.id;
  const currentDraft = agentId ? drafts[agentId] : undefined;
  useEffect(() => {
    const auth = sessionRef.current;
    if (!auth || !agentId) return;
    let cancelled = false;
    const context = epoch.current;
    gateway
      .getDraft(agentId, auth)
      .then((value) => {
        if (!cancelled && context === epoch.current)
          setDrafts((previous) =>
            previous[agentId]
              ? previous
              : {
                  ...previous,
                  [agentId]: value || { text: '', attachment: null },
                },
          );
      })
      .catch((error) => {
        if (!cancelled) fail(error, context);
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, scope, fail]);
  useEffect(() => {
    const auth = sessionRef.current;
    if (!auth || !agentId || !currentDraft) return;
    const context = epoch.current;
    const timer = setTimeout(() => {
      gateway
        .saveDraft(agentId, currentDraft, auth)
        .catch((error) => fail(error, context));
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [currentDraft, agentId, scope, fail]);
  useEffect(() => {
    const auth = sessionRef.current,
      id = agentId,
      context = epoch.current;
    return () => {
      if (auth && id && context === epoch.current && draftsRef.current[id]) {
        void gateway.saveDraft(id, draftsRef.current[id], auth).catch(() => {});
      }
    };
  }, [agentId, scope]);
  const changeDraft = (value: SetStateAction<string>) => {
    const id = agentId;
    if (
      !id ||
      scope !==
        `${sessionRef.current?.userId}:${sessionRef.current?.workspaceId}`
    )
      return;
    setDrafts((previous) => {
      const current = previous[id] || { text: '', attachment: null };
      return {
        ...previous,
        [id]: {
          ...current,
          text: typeof value === 'function' ? value(current.text) : value,
        },
      };
    });
  };
  const changeAttachment = (attachment: FileAttachment | null) => {
    const id = agentId;
    if (
      !id ||
      scope !==
        `${sessionRef.current?.userId}:${sessionRef.current?.workspaceId}`
    )
      return;
    setDrafts((previous) => ({
      ...previous,
      [id]: { ...(previous[id] || { text: '' }), attachment },
    }));
  };
  useEffect(() => {
    const auth = sessionRef.current;
    if (!auth || !queuedId || !foreground) return;
    const controller = new AbortController(),
      context = epoch.current;
    gateway.advanceRun(queuedId, auth, controller.signal).catch((error) => {
      if (!controller.signal.aborted) fail(error, context);
    });
    return () => controller.abort();
  }, [queuedId, scope, foreground, fail]);

  const login = async (email: string, password: string) => {
    if (!email.trim() || !password) {
      setNotice('Preenche o email e a palavra-passe.');
      return;
    }
    setLoginBusy(true);
    setNotice('');
    const context = epoch.current;
    try {
      const auth = await gateway.signIn(email, password);
      if (context !== epoch.current) return;
      await saveSession(auth);
      sessionRef.current = auth;
      setSession(auth);
    } catch (error) {
      if (context === epoch.current)
        setNotice(
          error instanceof Error
            ? error.message
            : 'Não foi possível iniciar sessão.',
        );
    } finally {
      setLoginBusy(false);
    }
  };
  const switchWorkspace = async (workspaceId: string) => {
    const auth = sessionRef.current;
    if (!auth || workspaceId === auth.workspaceId) return;
    if (!workspaces.some((workspace) => workspace.id === workspaceId))
      throw new Error('Espaço indisponível.');
    if (agentId && currentDraft)
      await gateway.saveDraft(agentId, currentDraft, auth);
    const next = { ...auth, workspaceId };
    gateway.api.invalidate();
    epoch.current++;
    reset();
    setPrimaryId(null);
    setShowAgents(false);
    sessionRef.current = next;
    gateway.api.activate(next);
    setSession(next);
    await saveSession(next);
  };
  const openAgent = (agent: Agent) => {
    if (agent.workspaceId !== sessionRef.current?.workspaceId) return;
    agentIdRef.current = agent.id;
    setAgentId(agent.id);
    setShowAgents(false);
    setSending(isTransmitting(agent.id, epoch.current));
  };
  const makePrimary = async (agent: Agent) => {
    const auth = sessionRef.current;
    if (!auth) return;
    try {
      await gateway.setPrimaryAgent(agent.id, auth);
      setPrimaryId(agent.id);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível guardar a preferência.',
      );
    }
  };
  const createAgent = async (
    name: string,
    description: string,
    avatar?: AgentAvatarChoice,
  ) => {
    const auth = sessionRef.current;
    if (!auth) return;
    const context = epoch.current;
    try {
      const agent = await gateway.createAgent(name, description, auth, avatar);
      if (context !== epoch.current) return;
      setAgents((value) => [agent, ...value]);
      setAgentId(agent.id);
      setShowAgents(false);
    } catch (error) {
      fail(error, context);
      throw error;
    }
  };
  const send = async (
    content: string,
    attachment?: FileAttachment,
    target?: Agent,
  ) => {
    const auth = sessionRef.current,
      selected = target || activeAgent;
    if (!auth || !selected) return;
    if (selected.workspaceId !== auth.workspaceId)
      throw new Error(
        'O agente pertence a outro espaço. Seleciona-o novamente.',
      );
    const context = epoch.current;
    const finishTransmission = beginTransmission(selected.id, context);
    let pendingMessageId: string | undefined;
    setSending(true);
    try {
      const run = await gateway.createRun(
        selected.id,
        content,
        attachment ? [attachment] : [],
        auth,
        undefined,
        (item) => {
          pendingMessageId = item.id;
          if (context === epoch.current && selected.id === agentIdRef.current) {
            transcriptRevision.current++;
            setTranscript((value) => ({
              ...value,
              pending: [
                ...value.pending.filter((entry) => entry.id !== item.id),
                { ...item, files: [...item.files] },
              ],
            }));
          }
        },
      );
      if (context === epoch.current && selected.id === agentIdRef.current) {
        transcriptRevision.current++;
        setTranscript((value) => ({
          runs: mergeRuns(value.runs, [run]),
          pending: acknowledgePending(value.pending, pendingMessageId, run),
        }));
        await refreshPending(selected.id, auth, context);
      }
    } catch (error) {
      fail(error, context);
      if (context === epoch.current && selected.id === agentIdRef.current)
        await refreshPending(selected.id, auth, context);
      throw error;
    } finally {
      finishTransmission();
      if (context === epoch.current && selected.id === agentIdRef.current)
        setSending(isTransmitting(selected.id, context));
    }
  };
  const retry = async (pendingId: string) => {
    const auth = sessionRef.current;
    if (!auth || !agentId) return;
    const context = epoch.current;
    const finishTransmission = beginTransmission(agentId, context);
    setSending(true);
    setTranscript((value) => ({
      ...value,
      pending: value.pending.map((item) =>
        item.id === pendingId
          ? { ...item, status: 'sending', error: undefined }
          : item,
      ),
    }));
    try {
      const run = await gateway.retryMessage(agentId, pendingId, auth);
      if (context === epoch.current && agentId === agentIdRef.current) {
        transcriptRevision.current++;
        setTranscript((value) => ({
          runs: mergeRuns(value.runs, [run]),
          pending: acknowledgePending(value.pending, pendingId, run),
        }));
        await refreshPending(agentId, auth, context);
      }
    } catch (error) {
      fail(error, context);
      if (context === epoch.current && agentId === agentIdRef.current)
        await refreshPending(agentId, auth, context);
    } finally {
      finishTransmission();
      if (context === epoch.current && agentId === agentIdRef.current)
        setSending(isTransmitting(agentId, context));
    }
  };
  const control = async (run: AgentRun, operation: RunOperation) => {
    const auth = sessionRef.current;
    if (!auth || run.workflowId !== agentIdRef.current) return;
    const context = epoch.current;
    setControlBusy(run.id);
    try {
      const fresh = await gateway.controlRun(run, operation, auth);
      if (context === epoch.current && run.workflowId === agentIdRef.current)
        setTranscript((value) => ({
          ...value,
          runs: mergeRuns(value.runs, [fresh]),
        }));
    } catch (error) {
      fail(error, context);
    } finally {
      if (context === epoch.current)
        setControlBusy((value) => (value === run.id ? null : value));
    }
  };
  async function refreshPending(id: string, auth: Session, context: number) {
    const observedRevision = transcriptRevision.current;
    const outbox = await gateway.getPending(id, auth);
    if (
      context === epoch.current &&
      id === agentIdRef.current &&
      observedRevision === transcriptRevision.current
    )
      setTranscript((value) => ({
        ...value,
        pending: isTransmitting(id, context)
          ? outbox
          : recoverUnconfirmedPending(outbox),
      }));
  }
  const discardPending = async (pendingId: string) => {
    const auth = sessionRef.current,
      id = agentIdRef.current,
      context = epoch.current;
    if (!auth || !id) return;
    if (isTransmitting(id, context)) {
      setNotice(
        'Aguarda a confirmação do envio antes de remover esta mensagem.',
      );
      return;
    }
    try {
      await gateway.discardPending(id, pendingId, auth);
      await refreshPending(id, auth, context);
    } catch (error) {
      fail(error, context);
    }
  };
  const openFile = async (runId: string, fileId: string) => {
    const auth = sessionRef.current;
    if (!auth) return;
    const context = epoch.current;
    try {
      const url = await gateway.getFileUrl(runId, fileId, auth);
      if (context === epoch.current) await Linking.openURL(url);
    } catch (error) {
      fail(error, context);
    }
  };
  const saveProfile = async (config: AgentConfig, grants: AgentGrants) => {
    const auth = sessionRef.current;
    if (!auth || !agentId || !profileKnown)
      throw new Error('Atualiza a configuração antes de guardar.');
    const context = epoch.current;
    await gateway.saveAgentProfile(
      agentId,
      { config, grants, revision: profile?.revision },
      auth,
    );
    const fresh = await gateway.getAgentProfile(agentId, auth);
    if (context === epoch.current && agentId === agentIdRef.current)
      setProfile(fresh);
  };
  const saveCapture = async (
    draft: Omit<CaptureItem, 'id' | 'createdAt' | 'synced'>,
  ) => {
    const auth = sessionRef.current;
    if (!auth) return;
    const context = epoch.current;
    let validated = draft;
    if (draft.uri) {
      const file = await readAttachment(
        draft.uri,
        draft.title,
        draft.mimeType || guessMime(draft.title),
        draft.size,
        draft.base64,
      );
      validated = {
        ...draft,
        title: file.name,
        mimeType: file.mimeType,
        size: file.size,
      };
    }
    const prepared = await persistCapture(validated, auth),
      saved = await gateway.saveCapture(prepared, auth);
    if (context === epoch.current) setCaptures((value) => [saved, ...value]);
  };
  const sendCapture = async (item: CaptureItem, target: Agent) => {
    try {
      const attachment = item.uri
        ? await readAttachment(
            item.uri,
            item.title,
            item.mimeType || guessMime(item.title),
            item.size,
            item.base64,
          )
        : undefined;
      openAgent(target);
      await send(
        item.note || `Analisa o ficheiro: ${item.title}`,
        attachment,
        target,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : 'Não foi possível enviar a captura.',
      );
    }
  };
  return {
    loaded,
    session,
    loginBusy,
    login,
    logout,
    switchWorkspace,
    agents,
    activeAgent,
    primaryId,
    makePrimary,
    openAgent,
    draft: currentDraft?.text || '',
    attachment: currentDraft?.attachment || null,
    changeDraft,
    changeAttachment,
    showAgents,
    setShowAgents,
    profile,
    profileKnown,
    runs: runs.filter((run) => run.workflowId === agentId),
    messages: conversationMessages(agentId || '', runs, pending),
    captures,
    credentials,
    variables,
    workspaces,
    notice,
    setNotice,
    connectionError,
    sending,
    controlBusy,
    send,
    retry,
    discardPending,
    control,
    openFile,
    saveProfile,
    saveCapture,
    sendCapture,
    createAgent,
    refresh: () => setRevision((value) => value + 1),
    getModels: (credentialId: string, provider: string) => {
      if (!sessionRef.current) throw new Error('Sessão necessária.');
      return gateway.getModels(credentialId, provider, sessionRef.current);
    },
  };
}
