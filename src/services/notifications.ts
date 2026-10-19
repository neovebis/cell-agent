import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import type { CellGateway, Session } from '../types';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function enableNotifications(api: CellGateway, session?: Session): Promise<string> {
  const existing = await Notifications.getPermissionsAsync();
  const permission = existing.granted ? existing : await Notifications.requestPermissionsAsync();
  if (!permission.granted) throw new Error('É necessário permitir notificações nas definições do telemóvel.');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('cell-missions', {
      name: 'Missões e aprovações', importance: Notifications.AndroidImportance.HIGH,
    });
  }
  if (api.demo) {
    // Apenas teste LOCAL e explicitamente de demonstração.
    await Notifications.scheduleNotificationAsync({
      content: { title: 'CELL AGENT · Demonstração', body: 'As notificações locais estão ativadas. O envio remoto exige integração do backend.' },
      trigger: null,
    });
    return 'Notificação local de teste enviada.';
  }
  if (!Device.isDevice) throw new Error('As notificações push devem ser testadas num dispositivo físico.');
  const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
  if (!projectId) throw new Error('Falta EXPO_PUBLIC_EAS_PROJECT_ID para gerar o token push.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await api.registerPush(token, session);
  return 'Dispositivo registado para notificações do backend partilhado.';
}
