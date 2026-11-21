import { site } from '../config/site';

type ChatWindow = Window & {
  $crisp?: unknown[][];
  Tawk_API?: { maximize?: () => void; onLoad?: () => void };
  Intercom?: (command: string) => void;
};

/** Opens the configured live-chat widget (queued until the provider's script has loaded). */
export function openLiveChat(): void {
  const w = window as ChatWindow;
  const provider = site.support.liveChatProvider;
  if (provider === 'crisp') {
    w.$crisp = w.$crisp ?? [];
    w.$crisp.push(['do', 'chat:open']);
  } else if (provider === 'tawk') {
    const api = (w.Tawk_API = w.Tawk_API ?? {});
    if (api.maximize) api.maximize();
    else api.onLoad = () => w.Tawk_API?.maximize?.();
  } else if (provider === 'intercom') {
    w.Intercom?.('show');
  }
}
