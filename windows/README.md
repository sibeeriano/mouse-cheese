# mouse and cheese para Windows

La macro de Excel, como app de escritorio. **Comenzar** deja un clic izquierdo donde ya está el puntero, cada 5, 15, 30 o 60 segundos. **Detener** lo corta. El cursor no se mueve.

No es un complemento de Office. Un complemento publicado en AppSource corre dentro de Excel y no puede llamar a `SendInput`. Esta app es un programa de Windows con confianza completa, empaquetado en MSIX para la Microsoft Store. Usa el mismo tipo de clic que la macro, sin el salto de cursor: la macro pasaba las coordenadas como si fueran un desplazamiento.

El primer clic espera el intervalo, para que el puntero no siga encima del botón. Si el puntero está sobre esta ventana, ese clic se salta.

## Compilar

Hace falta Windows 10 u 11, el SDK de .NET 8 y Visual Studio 2022 con la carga de trabajo de Windows App SDK.

Abrí `windows/MouseCheese.sln` y ejecutá el proyecto, o desde la raíz del repositorio:

```bash
dotnet build windows/MouseCheese/MouseCheese.csproj -c Release
```

El paquete MSIX se genera con:

```bash
dotnet publish windows/MouseCheese/MouseCheese.csproj -c Release -p:Platform=x64 -p:GenerateAppxPackageOnBuild=true
```

## Publicar en la Microsoft Store

1. Creá una cuenta de [Partner Center](https://partner.microsoft.com) (hay un pago único para una cuenta individual).
2. Reservá el nombre «mouse and cheese».
3. Reemplazá en `Package.appxmanifest` el `Identity` por el nombre y el publicador que te da Partner Center. El `Publisher` de ejemplo, `CN=MouseAndCheese`, solo sirve para probar en local.
4. En las opciones del envío, justificá la capacidad restringida `runFullTrust`: es una app de escritorio empaquetada y el clic del sistema no existe dentro del contenedor de una app UWP.
5. Subí el `.msix` (o el bundle), capturas, una política de privacidad y la clasificación de edad.

La ficha de la tienda tiene que decir que la app hace clic donde esté el puntero. Microsoft revisa `runFullTrust` y puede pedir ese texto.
