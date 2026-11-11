import { render } from 'preact'
import '@fontsource-variable/golos-text/index.css'
import '@fontsource-variable/unbounded/index.css'
import './styles.css'
import { App } from './app'
import { flushSave } from './state'

render(<App />, document.getElementById('root')!)

// Работа без интернета; новая версия ставится сама, когда приложение свёрнуто.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({
      immediate: true,
      onRegisteredSW(_url, reg) {
        if (reg) document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') reg.update().catch(() => {})
          else flushSave()
        })
      }
    })
  }).catch(() => {})
}
