import { useCallback, useRef, useState, useEffect } from 'react';
import { GoogleAdMob } from '@apps-in-toss/web-framework';

const TEST_AD_GROUP_ID = 'ait-ad-test-interstitial-id';

interface InterstitialAdCallback {
  onDismiss?: () => void;
  onUnavailable?: () => void;
}

export function useInterstitialAd(adGroupId: string = TEST_AD_GROUP_ID) {
  const [loading, setLoading] = useState(true);
  const [adSupported, setAdSupported] = useState(true);
  const dismissCallbackRef = useRef<(() => void) | undefined>();

  useEffect(() => {
    let isAdUnsupported = false;
    try {
      isAdUnsupported = GoogleAdMob?.loadAppsInTossAdMob?.isSupported?.() === false;
    } catch {
      isAdUnsupported = true;
    }

    if (isAdUnsupported) {
      console.warn('광고가 지원되지 않는 환경입니다.');
      setAdSupported(false);
      setLoading(false);
      return;
    }

    setLoading(true);

    const cleanup = GoogleAdMob.loadAppsInTossAdMob({
      options: {
        adGroupId,
      },
      onEvent: (event: any) => {
        if (event.type === 'loaded') {
          setLoading(false);
        }
      },
      onError: (error: any) => {
        console.error('광고 로드 실패', error);
        setLoading(false);
      },
    });

    return cleanup;
  }, [adGroupId]);

  const showInterstitialAd = useCallback(({ onDismiss, onUnavailable }: InterstitialAdCallback) => {
    let isAdUnsupported = false;
    try {
      isAdUnsupported = GoogleAdMob?.showAppsInTossAdMob?.isSupported?.() === false;
    } catch {
      isAdUnsupported = true;
    }

    if (!adSupported || isAdUnsupported) {
      console.warn('광고가 지원되지 않는 환경입니다.');
      onUnavailable?.();
      return;
    }

    if (loading) {
      console.warn('광고가 아직 로드되지 않았습니다.');
      onUnavailable?.();
      return;
    }

    dismissCallbackRef.current = onDismiss;

    GoogleAdMob.showAppsInTossAdMob({
      options: {
        adGroupId,
      },
      onEvent: (event: any) => {
        switch (event.type) {
          case 'requested':
            setLoading(true);
            break;
          case 'clicked':
            break;
          case 'dismissed':
            dismissCallbackRef.current?.();
            dismissCallbackRef.current = undefined;
            reloadAd();
            break;
          case 'failedToShow':
            console.warn('광고를 보여주지 못했습니다.');
            dismissCallbackRef.current?.();
            dismissCallbackRef.current = undefined;
            break;
          case 'impression':
            break;
          case 'show':
            break;
        }
      },
      onError: (error: any) => {
        console.error('광고 보여주기 실패', error);
        dismissCallbackRef.current?.();
        dismissCallbackRef.current = undefined;
      },
    });
  }, [loading, adSupported, adGroupId]);

  const reloadAd = useCallback(() => {
    if (!adSupported) return;

    setLoading(true);

    GoogleAdMob.loadAppsInTossAdMob({
      options: {
        adGroupId,
      },
      onEvent: (event: any) => {
        if (event.type === 'loaded') {
          setLoading(false);
        }
      },
      onError: (error: any) => {
        console.error('광고 재로드 실패', error);
        setLoading(false);
      },
    });
  }, [adSupported, adGroupId]);

  return {
    loading,
    adSupported,
    showInterstitialAd,
  };
}
