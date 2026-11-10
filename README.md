# mouse&cheese

El clic de la macro de Excel está en la app de Windows, en `windows/`. Se empaqueta en MSIX para la Microsoft Store. Hay que compilarla en Windows. Los pasos están en `windows/README.md`.

La página web solo puede mantener la pantalla encendida. El navegador no deja mover el ratón ni hacer clic en otras apps, y un complemento de Office tampoco.

## La página

Una página que mantiene la pantalla despierta. Cualquiera la abre en su navegador y pulsa **Comenzar**. No hay servidor local ni programa que instalar.

**Comenzar** pide un [Screen Wake Lock](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API): mientras la pestaña sigue abierta y visible, el navegador le dice al sistema que no apague la pantalla. **Detener** lo suelta. Si cambias de pestaña, el navegador puede soltarlo; al volver, la página lo pide otra vez.

El navegador no deja que una página mueva el ratón ni haga clic en Excel, Slack o Teams. Por eso esta web no imita la macro: no puede generar actividad de ratón en el sistema, y Slack o Teams pueden seguir marcando ausente. Lo que sí hace es evitar que se apague la pantalla.

Hace falta un navegador con Wake Lock: Chrome, Edge o Safari. El botón tiene que pulsarse en la propia página, con la pestaña a la vista.

## Cómo verla en local

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:38471](http://127.0.0.1:38471).

## Publicarla

```bash
npx vercel
```

Quien abra el enlace usa el botón en su propio navegador. El servidor solo entrega la página.
