import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

// Só para o banner "Sem conexão". Escrita nunca finge sucesso por causa dele:
// quem decide é a resposta real da API.
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    return NetInfo.addEventListener((s) => {
      setOnline(s.isConnected !== false && s.isInternetReachable !== false);
    });
  }, []);
  return online;
}
