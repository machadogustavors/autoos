import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';

// Recarrega ao voltar para a tela (ex.: depois de criar OS/item), mas não no
// primeiro foco — esse já é o load inicial do useResource.
export function useReloadOnFocus(reload: () => void): void {
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      reload();
    }, [reload]),
  );
}
