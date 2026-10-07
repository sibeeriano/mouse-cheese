# mouse&cheese

Un ratón que mordisquea el puntero para que el equipo no se suspenda y Slack, Teams u otras apps no te marquen ausente.

La página es un cartel retro. **Comenzar** pone en marcha un solo bucle en el servidor de Next.js. Cada cierto tiempo el puntero se aparta unos 30–40 píxeles, se queda cerca de medio segundo (para que se note) y vuelve al sitio. **Detener** corta el bucle. Elegir el intervalo no arranca el mordisco: hace falta pulsar Comenzar. El navegador no puede mover el puntero del sistema: lo hace el proceso de Node, con el comando nativo de cada sistema.

## Cómo correrlo

```bash
npm install
npm run dev
```

Abre [http://127.0.0.1:38471](http://127.0.0.1:38471).

El servidor escucha en `0.0.0.0:38471`. Tiene que estar en marcha **en el ordenador cuyo puntero quieres mover**. Si abres la página desde otro equipo, o si el servidor corre en una máquina remota, el cursor de tu escritorio no se mueve.

No expongas el puerto en una red que no controles: quien pueda llamar a la API en `localhost` puede arrancar el mordisco. Desde otro nombre de host, Comenzar se niega.

## Vercel

El cartel se puede publicar en Vercel para que cualquiera lo vea:

```bash
npx vercel
```

Eso no mueve el ratón de quien abre el enlace. El navegador no tiene permiso para mover el puntero del sistema, y la función de Vercel corre en un centro de datos, sin tu pantalla ni tu ratón. Cada persona que quiera el mordisco tiene que ejecutar `npm run dev` en su propia computadora y abrir `http://127.0.0.1:38471`.

Si la página no se sirve desde `localhost` o `127.0.0.1`, el cartel lo dice y no intenta mover nada.

## Permisos

- **macOS.** El movimiento usa Python 3 y Quartz (`CGEvent`, eventos de ratón movido). Si el sistema lo bloquea, entra en Ajustes del Sistema → Privacidad y seguridad → Accesibilidad y permite la terminal o la app que ejecuta el servidor (Terminal, iTerm o el proceso de Node). Si Python no tiene Quartz, se intenta `cliclick`.
- **Linux.** Se usa `xdotool mousemove_relative` (ida y vuelta). Si no está, se intenta `ydotool`. Hace falta una sesión gráfica (`DISPLAY` o el demonio de ydotool).
- **Windows.** PowerShell llama a `mouse_event` con `MOUSEEVENTF_MOVE` (`0x0001`): un empujón y el inverso.

El intervalo se elige en la página: 5, 15, 30 o 60 segundos. Por defecto, 15. Nada se mueve hasta que pulsas Comenzar. Al salir el proceso, el bucle se cancela.
