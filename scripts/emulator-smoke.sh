#!/usr/bin/env bash
# Teste de fumaça do APK num emulador Android (roda no GitHub Actions). Instala, abre, confere que o app
# desenhou, testa um atalho do ícone e o descanso nativo (alarme agendado + notificação com contagem).
set -u
APK="$1"
PKG=com.oadrianrabelo.cadernodecargas
OUT="${2:-emulador}"
mkdir -p "$OUT"
fail() { echo "::error::$1"; adb logcat -d | grep -iE "AndroidRuntime|$PKG|Capacitor" | tail -80; exit 1; }
dump() { adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; adb shell cat /sdcard/ui.xml; }
waitfor() { # espera um texto aparecer na tela (até ~40 s)
  for i in $(seq 1 20); do dump > "$OUT/ui.xml"; grep -q "$1" "$OUT/ui.xml" && return 0; sleep 2; done; return 1
}

adb logcat -c
adb install -r "$APK" || fail "APK não instalou"
adb shell pm grant $PKG android.permission.POST_NOTIFICATIONS || true
adb shell am start -W -n $PKG/.MainActivity || fail "app não abriu"
waitfor 'Semana' || { adb exec-out screencap -p > "$OUT/1-abertura.png"; fail "a tela do app não apareceu"; }
adb exec-out screencap -p > "$OUT/1-abertura.png"
echo "ok: app abriu e desenhou a tela"

# Atalho do ícone: Progresso.
adb shell am start -a android.intent.action.VIEW -d caderno://progresso -n $PKG/.MainActivity >/dev/null
waitfor 'treinos feitos' || { adb exec-out screencap -p > "$OUT/2-atalho.png"; fail "o atalho Progresso não abriu o painel"; }
adb exec-out screencap -p > "$OUT/2-atalho.png"
echo "ok: atalho Progresso"

# Voltar fecha a folha (o app continua aberto).
adb shell input keyevent KEYCODE_BACK
sleep 2
dump > "$OUT/ui.xml"
grep -q 'treinos feitos' "$OUT/ui.xml" && fail "voltar não fechou a folha"
adb shell pidof $PKG >/dev/null || fail "voltar fechou o app"
echo "ok: botão voltar"

# Descanso: toca no ✓ da primeira série e confere alarme + notificação de contagem.
node=$(grep -o '<node[^>]*Marcar série 1 como feita[^>]*>' "$OUT/ui.xml" | head -1)
b=$(echo "$node" | grep -o 'bounds="\[[0-9]*,[0-9]*\]\[[0-9]*,[0-9]*\]"' | grep -o '[0-9]*' | tr '\n' ' ')
[ -n "$b" ] || fail "não achei o botão da série na tela"
set -- $b
adb shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
sleep 3
adb exec-out screencap -p > "$OUT/3-descanso.png"
adb shell dumpsys notification --noredact > "$OUT/notificacoes.txt"
grep -q "descanso_contagem" "$OUT/notificacoes.txt" || fail "a notificação de contagem do descanso não apareceu"
adb shell dumpsys alarm > "$OUT/alarmes.txt"
grep -q "$PKG" "$OUT/alarmes.txt" || fail "o alarme do descanso não foi agendado"
echo "ok: descanso com notificação e alarme"

# Nenhum erro fatal no processo do app.
adb logcat -d > "$OUT/logcat.txt"
grep -A20 "FATAL EXCEPTION" "$OUT/logcat.txt" | grep -q "$PKG" && fail "o app teve um erro fatal"
adb shell pidof $PKG >/dev/null || fail "o app fechou sozinho"
echo "ok: sem erros fatais"
