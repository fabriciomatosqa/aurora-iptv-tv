# Android TV / Google TV — Prévia de desenvolvimento

O projeto apps/android-tv agora possui uma Activity TV, WebViewAssetLoader de origem local e player Media3/ExoPlayer. A interface M3U permanece compartilhada.

## Compilar no GitHub

Abra Actions → Build Android TV developer APK e baixe o artefato aurora-iptv-tv-android-debug-apk se o workflow concluir com sucesso.

## Compilar localmente

Precisa de JDK 17, Gradle 8.9, SDK 35 e Node 20+.

```sh
node scripts/sync-android-assets.mjs
cd apps/android-tv
gradle :app:assembleDebug
```

O arquivo será apps/android-tv/app/build/outputs/apk/debug/app-debug.apk. Utilize adb install para instalar em ambiente com depuração autorizada.

## Limites

Este é um APK debug e não é um app aprovado na Play Store. O Media3 ainda exige testes reais de reprodução, codecs, controle e áudio/legendas.
Fontes HTTP são aceitas como compatibilidade de teste, mas prefira HTTPS. A importação preliminar está limitada a 16 MB; não compartilhe credenciais.
