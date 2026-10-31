import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin';
import { isApiError } from '../api/errors';
import type { User } from '../api/types';
import { config } from '../config';
import { onSessionExpired, services } from './services';

export type SessionStatus = 'booting' | 'signedOut' | 'signedIn';

interface SessionValue {
  status: SessionStatus;
  user: User | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

// Mensagens do login (RF-01). Erro de Sign-In é copy nossa, nunca texto do SDK.
export class SignInError extends Error {}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>('booting');
  const [user, setUser] = useState<User | null>(null);

  const expire = useCallback(() => {
    setUser(null);
    setStatus('signedOut');
  }, []);

  useEffect(() => {
    onSessionExpired(expire);
    GoogleSignin.configure({ webClientId: config.googleWebClientId });

    services.auth
      .restore()
      .then((restored) => {
        setUser(restored);
        setStatus(restored ? 'signedIn' : 'signedOut');
      })
      // Sem rede no boot: cai no login, mas o token seguro NÃO é apagado —
      // o próximo boot com rede restaura a sessão.
      .catch(() => setStatus('signedOut'));
  }, [expire]);

  const signIn = useCallback(async () => {
    let idToken: string | null = null;
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // cancelou: sem erro
      idToken = response.data.idToken;
    } catch (error) {
      if (isErrorWithCode(error)) {
        throw new SignInError('Não foi possível entrar com o Google.');
      }
      throw error;
    }
    if (!idToken) {
      throw new SignInError('Não foi possível entrar com o Google.');
    }

    try {
      const loggedIn = await services.auth.login(idToken);
      setUser(loggedIn);
      setStatus('signedIn');
    } catch (error) {
      if (isApiError(error) && error.status === 403) {
        throw new SignInError(
          'Este e-mail não está cadastrado no AutoOS. Fale com a oficina.',
        );
      }
      if (isApiError(error) && error.isTransient) {
        throw new SignInError('Sem conexão. Tente de novo.');
      }
      throw new SignInError('Não foi possível entrar. Tente de novo.');
    }
  }, []);

  const signOut = useCallback(async () => {
    await services.auth.logout();
    await GoogleSignin.signOut().catch(() => null);
    expire();
  }, [expire]);

  const value = useMemo(
    () => ({ status, user, signIn, signOut }),
    [status, user, signIn, signOut],
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession fora do SessionProvider');
  return value;
}
