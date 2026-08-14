# corregir-tutoriales.ps1
#
# Corrige los tutoriales (guias paso a paso) de la app:
#   1) En Convocatorias, dar clic al avatar de Ecori ya vuelve a abrir el
#      tutorial/ayuda (antes no hacia nada, porque solo Babel tenia ese
#      comportamiento por default).
#   2) Se agregan explicaciones para las zonas que no tenian tutorial:
#      - Convocatorias: boton "Agendar cita con mentor", panel de cifras
#        (Stats) y el panel de resultados de busqueda.
#      - Inicio: la seccion de Toolbox y Mundos Premium.
#      - Worlds: la lista de misiones del Mundo de Partida y el bloque de
#        Plan de Accion (dentro de Estrategia).
#
# Corre esto desde la raiz del proyecto (donde esta la carpeta 'src'):
#   powershell -ExecutionPolicy Bypass -File .\corregir-tutoriales.ps1

$ErrorActionPreference = "Stop"

function Read-Utf8NoBom($path) {
    $bytes = [System.IO.File]::ReadAllBytes($path)
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
    if ($text.Length -gt 0 -and $text[0] -eq [char]0xFEFF) {
        $text = $text.Substring(1)
    }
    return $text
}

function Write-Utf8NoBom($path, $text) {
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
}

# ---------------------------------------------------------------------------
# Archivo 1: src\components\babel\ConvocatoriasBuilder.tsx
# ---------------------------------------------------------------------------
$convoPath = "src\components\babel\ConvocatoriasBuilder.tsx"

if (-not (Test-Path -LiteralPath $convoPath)) {
    Write-Error "No encontre '$convoPath'. Corre este script desde la raiz de tu proyecto (donde esta la carpeta 'src')."
    exit 1
}

$fullConvoPath = (Resolve-Path -LiteralPath $convoPath).Path
$convoContent = Read-Utf8NoBom $fullConvoPath
$convoChanged = $false

# --- 1a) Import del evento de ayuda ---
$pattern1a = "import PageTour, \{ type TourStep \} from '@/components/ui/executive/PageTour';\r?\n"
$regex1a = New-Object System.Text.RegularExpressions.Regex($pattern1a)
$m1a = $regex1a.Matches($convoContent)

if ($m1a.Count -eq 1) {
    $new1a = "import PageTour, { type TourStep } from '@/components/ui/executive/PageTour';`r`nimport { BABEL_AYUDA_EVENT } from '@/components/babel/BabelAvatar';`r`n"
    $match = $m1a[0]
    $convoContent = $convoContent.Substring(0, $match.Index) + $new1a + $convoContent.Substring($match.Index + $match.Length)
    $convoChanged = $true
    Write-Host "[OK] Convocatorias: se agrego el import de BABEL_AYUDA_EVENT."
}
elseif ($convoContent -match [regex]::Escape("import { BABEL_AYUDA_EVENT } from '@/components/babel/BabelAvatar';")) {
    Write-Host "[OK - ya estaba bien] Convocatorias: el import de BABEL_AYUDA_EVENT ya existia. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre la linea del import de PageTour tal cual la esperaba en $convoPath. No se modifico esta parte. Pegame las lineas 1 a 10 de ese archivo."
}

# --- 1b) Clic en el avatar de Ecori reabre el tutorial (2 apariciones) ---
$pattern1b = [regex]::Escape('<AgentAvatar agente="Ecori" size={56} className="shrink-0" />')
$regex1b = New-Object System.Text.RegularExpressions.Regex($pattern1b)
$m1b = $regex1b.Matches($convoContent)

if ($m1b.Count -eq 2) {
    $new1b = '<AgentAvatar agente="Ecori" size={56} className="shrink-0" onClick={() => window.dispatchEvent(new CustomEvent(BABEL_AYUDA_EVENT))} />'
    for ($i = $m1b.Count - 1; $i -ge 0; $i--) {
        $match = $m1b[$i]
        $convoContent = $convoContent.Substring(0, $match.Index) + $new1b + $convoContent.Substring($match.Index + $match.Length)
    }
    $convoChanged = $true
    Write-Host "[OK] Convocatorias: el avatar de Ecori ahora si reabre el tutorial/ayuda al dar clic (2 apariciones corregidas)."
}
elseif ($convoContent -match [regex]::Escape("onClick={() => window.dispatchEvent(new CustomEvent(BABEL_AYUDA_EVENT))}")) {
    Write-Host "[OK - ya estaba bien] Convocatorias: el avatar de Ecori ya reabre el tutorial. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre las 2 apariciones esperadas del avatar de Ecori en $convoPath (encontre $($m1b.Count)). No se modifico esta parte. Pegame las lineas 415 a 430 y 528 a 540 de ese archivo."
}

# --- 1c) id para el bloque "Agendar cita con mentor" ---
$pattern1c = [regex]::Escape('<div className="glass-panel mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">')
$regex1c = New-Object System.Text.RegularExpressions.Regex($pattern1c)
$m1c = $regex1c.Matches($convoContent)

if ($m1c.Count -eq 1) {
    $new1c = '<div id="convocatorias-agendar" className="glass-panel mt-4 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">'
    $match = $m1c[0]
    $convoContent = $convoContent.Substring(0, $match.Index) + $new1c + $convoContent.Substring($match.Index + $match.Length)
    $convoChanged = $true
    Write-Host "[OK] Convocatorias: se agrego el identificador del bloque 'Agendar cita con mentor'."
}
elseif ($convoContent -match [regex]::Escape('id="convocatorias-agendar"')) {
    Write-Host "[OK - ya estaba bien] Convocatorias: el bloque 'Agendar cita con mentor' ya tenia su identificador. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre el bloque de 'Agendar cita con mentor' tal cual lo esperaba en $convoPath. No se modifico esta parte."
}

# --- 1d) id para el bloque de cifras (Stats) ---
$pattern1d = [regex]::Escape('<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">')
$regex1d = New-Object System.Text.RegularExpressions.Regex($pattern1d)
$m1d = $regex1d.Matches($convoContent)

if ($m1d.Count -eq 1) {
    $new1d = '<div id="convocatorias-stats" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">'
    $match = $m1d[0]
    $convoContent = $convoContent.Substring(0, $match.Index) + $new1d + $convoContent.Substring($match.Index + $match.Length)
    $convoChanged = $true
    Write-Host "[OK] Convocatorias: se agrego el identificador del panel de cifras (Stats)."
}
elseif ($convoContent -match [regex]::Escape('id="convocatorias-stats"')) {
    Write-Host "[OK - ya estaba bien] Convocatorias: el panel de cifras ya tenia su identificador. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre el panel de cifras (grid-cols-4) tal cual lo esperaba en $convoPath. No se modifico esta parte."
}

# --- 1e) Nuevos pasos de tutorial (es): agendar + stats, entre title y buscar ---
$pattern1e = "'Directorio de convocatorias, premios, becas y fondos alineados a los ODS para tu organizaci" + [char]0x00F3 + "n\. C" + [char]0x00E9 + "ntrate en los que est" + [char]0x00E1 + "n abiertos\.',\r?\n" + `
             "[ \t]*\},\r?\n" + `
             "[ \t]*\{\r?\n" + `
             "[ \t]*selector: '#convocatorias-buscar',"
$regex1e = New-Object System.Text.RegularExpressions.Regex($pattern1e)
$m1e = $regex1e.Matches($convoContent)

if ($m1e.Count -eq 1) {
    $new1e = @'
'Directorio de convocatorias, premios, becas y fondos alineados a los ODS para tu organización. Céntrate en los que están abiertos.',
    },
    {
      selector: '#convocatorias-agendar',
      title: 'Agenda con tu mentor',
      description:
        'Si una convocatoria te genera dudas, agenda una sesión con tu mentor para revisar si aplica y cómo preparar tu postulación.',
    },
    {
      selector: '#convocatorias-stats',
      title: 'Panorama general',
      description:
        'Aquí ves de un vistazo cuántas convocatorias hay en total, cuántas están abiertas ahora, el monto disponible y cuándo se actualizó el directorio.',
    },
    {
      selector: '#convocatorias-buscar',
'@
    $match = $m1e[0]
    $convoContent = $convoContent.Substring(0, $match.Index) + $new1e + $convoContent.Substring($match.Index + $match.Length)
    $convoChanged = $true
    Write-Host "[OK] Convocatorias: se agregaron los pasos de tutorial (ES) para 'Agendar' y 'Cifras'."
}
elseif ($convoContent -match [regex]::Escape("selector: '#convocatorias-agendar'")) {
    Write-Host "[OK - ya estaba bien] Convocatorias: los pasos de tutorial (ES) para 'Agendar' y 'Cifras' ya existian. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre el punto de insercion (ES) para los pasos 'Agendar'/'Cifras' en $convoPath. No se modifico esta parte. Pegame las lineas 145 a 190 de ese archivo."
}

# --- 1f) Nuevos pasos de tutorial (es): resultados, entre buscar y catalogo ---
$pattern1f = "'Captura el perfil de tu organizaci" + [char]0x00F3 + "n \(tipo, ubicaci" + [char]0x00F3 + "n, a" + [char]0x00F1 + "os de operaci" + [char]0x00F3 + "n, edad, ODS y liderazgo\) y pulsa \`"Buscar mis convocatorias\`" para ver a cu" + [char]0x00E1 + "les puedes aplicar y por qu" + [char]0x00E9 + "\.',\r?\n" + `
             "[ \t]*\},\r?\n" + `
             "[ \t]*\{\r?\n" + `
             "[ \t]*selector: '#convocatorias-catalogo',"
$regex1f = New-Object System.Text.RegularExpressions.Regex($pattern1f)
$m1f = $regex1f.Matches($convoContent)

if ($m1f.Count -eq 1) {
    $new1f = @'
'Captura el perfil de tu organización (tipo, ubicación, años de operación, edad, ODS y liderazgo) y pulsa "Buscar mis convocatorias" para ver a cuáles puedes aplicar y por qué.',
    },
    {
      selector: '#convocatorias-resultados',
      title: 'Tus resultados',
      description:
        'Después de buscar por perfil verás dos grupos: las convocatorias a las que sí puedes aplicar y las que no cumples todavía, con el motivo de cada una.',
    },
    {
      selector: '#convocatorias-catalogo',
'@
    $match = $m1f[0]
    $convoContent = $convoContent.Substring(0, $match.Index) + $new1f + $convoContent.Substring($match.Index + $match.Length)
    $convoChanged = $true
    Write-Host "[OK] Convocatorias: se agrego el paso de tutorial (ES) para 'Tus resultados'."
}
elseif ($convoContent -match [regex]::Escape("selector: '#convocatorias-resultados'")) {
    Write-Host "[OK - ya estaba bien] Convocatorias: el paso de tutorial (ES) para 'Tus resultados' ya existia. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre el punto de insercion (ES) para el paso 'Tus resultados' en $convoPath. No se modifico esta parte."
}

# --- 1g) Nuevos pasos de tutorial (en): agendar + stats, entre title y buscar ---
$pattern1g = "'Directory of calls for proposals, awards, fellowships and grants aligned with the SDGs for your organization\. Focus on the ones that are open\.',\r?\n" + `
             "[ \t]*\},\r?\n" + `
             "[ \t]*\{\r?\n" + `
             "[ \t]*selector: '#convocatorias-buscar',"
$regex1g = New-Object System.Text.RegularExpressions.Regex($pattern1g)
$m1g = $regex1g.Matches($convoContent)

if ($m1g.Count -eq 1) {
    $new1g = @'
'Directory of calls for proposals, awards, fellowships and grants aligned with the SDGs for your organization. Focus on the ones that are open.',
    },
    {
      selector: '#convocatorias-agendar',
      title: 'Book time with your mentor',
      description:
        'If a call raises questions, book a session with your mentor to check whether it applies to you and how to prepare your application.',
    },
    {
      selector: '#convocatorias-stats',
      title: 'At a glance',
      description:
        'See at a glance the total number of calls, how many are open right now, the available amount, and when the directory was last updated.',
    },
    {
      selector: '#convocatorias-buscar',
'@
    $match = $m1g[0]
    $convoContent = $convoContent.Substring(0, $match.Index) + $new1g + $convoContent.Substring($match.Index + $match.Length)
    $convoChanged = $true
    Write-Host "[OK] Convocatorias: se agregaron los pasos de tutorial (EN) para 'Book time' y 'At a glance'."
}
elseif ($convoContent -match [regex]::Escape("selector: '#convocatorias-agendar'") -and ($convoContent -match [regex]::Escape("Book time with your mentor"))) {
    Write-Host "[OK - ya estaba bien] Convocatorias: los pasos de tutorial (EN) ya existian. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre el punto de insercion (EN) para los pasos 'Book time'/'At a glance' en $convoPath. No se modifico esta parte."
}

# --- 1h) Nuevos pasos de tutorial (en): resultados, entre buscar y catalogo ---
$pattern1h = "'Enter your organization profile \(type, location, years in operation, age, SDGs and leadership\) and press \`"Find my calls\`" to see which ones you can apply to and why\.',\r?\n" + `
             "[ \t]*\},\r?\n" + `
             "[ \t]*\{\r?\n" + `
             "[ \t]*selector: '#convocatorias-catalogo',"
$regex1h = New-Object System.Text.RegularExpressions.Regex($pattern1h)
$m1h = $regex1h.Matches($convoContent)

if ($m1h.Count -eq 1) {
    $new1h = @'
'Enter your organization profile (type, location, years in operation, age, SDGs and leadership) and press "Find my calls" to see which ones you can apply to and why.',
    },
    {
      selector: '#convocatorias-resultados',
      title: 'Your results',
      description:
        'After searching by profile you will see two groups: the calls you can apply to and the ones you do not meet yet, with the reason for each.',
    },
    {
      selector: '#convocatorias-catalogo',
'@
    $match = $m1h[0]
    $convoContent = $convoContent.Substring(0, $match.Index) + $new1h + $convoContent.Substring($match.Index + $match.Length)
    $convoChanged = $true
    Write-Host "[OK] Convocatorias: se agrego el paso de tutorial (EN) para 'Your results'."
}
elseif ($convoContent -match [regex]::Escape("selector: '#convocatorias-resultados'") -and ($convoContent -match [regex]::Escape("Your results"))) {
    Write-Host "[OK - ya estaba bien] Convocatorias: el paso de tutorial (EN) para 'Your results' ya existia. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre el punto de insercion (EN) para el paso 'Your results' en $convoPath. No se modifico esta parte."
}

if ($convoChanged) {
    Write-Utf8NoBom $fullConvoPath $convoContent
}

# ---------------------------------------------------------------------------
# Archivo 2: src\components\babel\InicioBuilder.tsx
# ---------------------------------------------------------------------------
$inicioPath = "src\components\babel\InicioBuilder.tsx"

if (-not (Test-Path -LiteralPath $inicioPath)) {
    Write-Error "No encontre '$inicioPath'. Corre este script desde la raiz de tu proyecto (donde esta la carpeta 'src')."
    exit 1
}

$fullInicioPath = (Resolve-Path -LiteralPath $inicioPath).Path
$inicioContent = Read-Utf8NoBom $fullInicioPath
$inicioChanged = $false

# --- 2a) Paso de tutorial (es) para Toolbox y Mundos Premium ---
$pattern2a = "description: '" + [char]0x00A1 + "Hola! Aqu" + [char]0x00ED + " empieza tu viaje con MBE: nosotros transformamos tu empresa y t" + [char]0x00FA + " el mundo\.' \},\r?\n" + `
             "[ \t]*\{ selector: '#inicio-agentes',"
$regex2a = New-Object System.Text.RegularExpressions.Regex($pattern2a)
$m2a = $regex2a.Matches($inicioContent)

if ($m2a.Count -eq 1) {
    $new2a = @'
description: '¡Hola! Aquí empieza tu viaje con MBE: nosotros transformamos tu empresa y tú el mundo.' },
    { selector: '#inicio-dual', title: 'Toolbox y Mundos Premium', description: 'El Toolbox (fondos, comunidad y mentoría) se desbloquea al completar el Mundo de Partida. Los Mundos Premium, cada uno con su especialista, requieren el plan mensual.' },
    { selector: '#inicio-agentes',
'@
    $match = $m2a[0]
    $inicioContent = $inicioContent.Substring(0, $match.Index) + $new2a + $inicioContent.Substring($match.Index + $match.Length)
    $inicioChanged = $true
    Write-Host "[OK] Inicio: se agrego el paso de tutorial (ES) 'Toolbox y Mundos Premium'."
}
elseif ($inicioContent -match [regex]::Escape("selector: '#inicio-dual'") -and ($inicioContent -match [regex]::Escape("Toolbox y Mundos Premium"))) {
    Write-Host "[OK - ya estaba bien] Inicio: el paso (ES) 'Toolbox y Mundos Premium' ya existia. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre el punto de insercion (ES) para el paso 'Toolbox y Mundos Premium' en $inicioPath. No se modifico esta parte. Pegame las lineas 206 a 220 de ese archivo."
}

# --- 2b) Paso de tutorial (en) para Toolbox y Mundos Premium ---
$pattern2b = "description: 'Hi! Your journey with MBE starts here: we transform your company and you transform the world\.' \},\r?\n" + `
             "[ \t]*\{ selector: '#inicio-agentes',"
$regex2b = New-Object System.Text.RegularExpressions.Regex($pattern2b)
$m2b = $regex2b.Matches($inicioContent)

if ($m2b.Count -eq 1) {
    $new2b = @'
description: 'Hi! Your journey with MBE starts here: we transform your company and you transform the world.' },
    { selector: '#inicio-dual', title: 'Toolbox and Premium Worlds', description: 'The Toolbox (funds, community and mentoring) unlocks once you complete the Starting World. The Premium Worlds, each with its own specialist, require the monthly plan.' },
    { selector: '#inicio-agentes',
'@
    $match = $m2b[0]
    $inicioContent = $inicioContent.Substring(0, $match.Index) + $new2b + $inicioContent.Substring($match.Index + $match.Length)
    $inicioChanged = $true
    Write-Host "[OK] Inicio: se agrego el paso de tutorial (EN) 'Toolbox and Premium Worlds'."
}
elseif ($inicioContent -match [regex]::Escape("selector: '#inicio-dual'") -and ($inicioContent -match [regex]::Escape("Toolbox and Premium Worlds"))) {
    Write-Host "[OK - ya estaba bien] Inicio: el paso (EN) 'Toolbox and Premium Worlds' ya existia. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre el punto de insercion (EN) para el paso 'Toolbox and Premium Worlds' en $inicioPath. No se modifico esta parte."
}

if ($inicioChanged) {
    Write-Utf8NoBom $fullInicioPath $inicioContent
}

# ---------------------------------------------------------------------------
# Archivo 3: src\components\worlds\WorldsBuilder.tsx
# ---------------------------------------------------------------------------
$wbPath = "src\components\worlds\WorldsBuilder.tsx"

if (-not (Test-Path -LiteralPath $wbPath)) {
    Write-Error "No encontre '$wbPath'. Corre este script desde la raiz de tu proyecto (donde esta la carpeta 'src')."
    exit 1
}

$fullWbPath = (Resolve-Path -LiteralPath $wbPath).Path
$wbContent = Read-Utf8NoBom $fullWbPath
$wbChanged = $false

$pattern3 = ": 'Each mission opens a real tool \(Dashboard or Strategic Objectives\)\. You can redo them whenever your company changes\.',\r?\n" + `
            "[ \t]*\},\r?\n" + `
            "[ \t]*\]\}\r?\n" + `
            "[ \t]*/>"
$regex3 = New-Object System.Text.RegularExpressions.Regex($pattern3)
$m3 = $regex3.Matches($wbContent)

if ($m3.Count -eq 1) {
    $new3 = @'
: 'Each mission opens a real tool (Dashboard or Strategic Objectives). You can redo them whenever your company changes.',
          },
          {
            selector: '#worlds-misiones',
            title: lang === 'es' ? 'Tus misiones' : 'Your missions',
            description: lang === 'es'
              ? 'Completa las misiones en orden: cada tarjeta se desbloquea al terminar la anterior. Las misiones repetibles puedes volver a hacerlas cuando cambie tu empresa.'
              : 'Complete the missions in order: each card unlocks once you finish the previous one. Repeatable missions can be redone whenever your company changes.',
          },
          {
            selector: '#estrategia-plan-accion',
            title: lang === 'es' ? 'Plan de Acción' : 'Action Plan',
            description: lang === 'es'
              ? 'Se desbloquea cuando defines tu Plan de Acción: conecta los temas de cada agente con las buenas prácticas a trabajar, mes a mes.'
              : 'Unlocks once you define your Action Plan: it connects the topics of each agent with the practices to work on, month by month.',
          },
        ]}
      />
'@
    $match = $m3[0]
    $wbContent = $wbContent.Substring(0, $match.Index) + $new3 + $wbContent.Substring($match.Index + $match.Length)
    $wbChanged = $true
    Write-Host "[OK] Worlds: se agregaron los pasos de tutorial 'Tus misiones' y 'Plan de Accion'."
}
elseif ($wbContent -match [regex]::Escape("selector: '#worlds-misiones'")) {
    Write-Host "[OK - ya estaba bien] Worlds: los pasos 'Tus misiones' y 'Plan de Accion' ya existian. No se modifico esta parte."
}
else {
    Write-Warning "[FALTA] No encontre el punto de insercion para los pasos 'Tus misiones'/'Plan de Accion' en $wbPath. No se modifico esta parte. Pegame las lineas 1235 a 1260 de ese archivo."
}

if ($wbChanged) {
    Write-Utf8NoBom $fullWbPath $wbContent
}

# ---------------------------------------------------------------------------
# Verificacion final
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "--- Verificacion final ---"

$finalConvo = [System.IO.File]::ReadAllText($fullConvoPath)
if ($finalConvo -match [regex]::Escape("import { BABEL_AYUDA_EVENT } from '@/components/babel/BabelAvatar';")) {
    Write-Host "[OK] ConvocatoriasBuilder.tsx: import de BABEL_AYUDA_EVENT -> presente."
} else { Write-Warning "[FALTA] ConvocatoriasBuilder.tsx: no encontre el import de BABEL_AYUDA_EVENT." }

if ((($finalConvo -split [regex]::Escape("onClick={() => window.dispatchEvent(new CustomEvent(BABEL_AYUDA_EVENT))}")).Count - 1) -ge 2) {
    Write-Host "[OK] ConvocatoriasBuilder.tsx: avatar de Ecori reabre el tutorial (x2) -> presente."
} else { Write-Warning "[FALTA] ConvocatoriasBuilder.tsx: no encontre las 2 apariciones del onClick en el avatar de Ecori." }

if ($finalConvo -match [regex]::Escape('id="convocatorias-agendar"') -and $finalConvo -match [regex]::Escape("selector: '#convocatorias-agendar'")) {
    Write-Host "[OK] ConvocatoriasBuilder.tsx: bloque 'Agendar' con id y paso de tutorial -> presente."
} else { Write-Warning "[FALTA] ConvocatoriasBuilder.tsx: revisa el bloque 'Agendar' (id y/o paso de tutorial)." }

if ($finalConvo -match [regex]::Escape('id="convocatorias-stats"') -and $finalConvo -match [regex]::Escape("selector: '#convocatorias-stats'")) {
    Write-Host "[OK] ConvocatoriasBuilder.tsx: panel de cifras con id y paso de tutorial -> presente."
} else { Write-Warning "[FALTA] ConvocatoriasBuilder.tsx: revisa el panel de cifras (id y/o paso de tutorial)." }

if ($finalConvo -match [regex]::Escape("selector: '#convocatorias-resultados'")) {
    Write-Host "[OK] ConvocatoriasBuilder.tsx: paso de tutorial 'resultados' -> presente."
} else { Write-Warning "[FALTA] ConvocatoriasBuilder.tsx: no encontre el paso de tutorial 'resultados'." }

$finalInicio = [System.IO.File]::ReadAllText($fullInicioPath)
if ($finalInicio -match [regex]::Escape("selector: '#inicio-dual'")) {
    Write-Host "[OK] InicioBuilder.tsx: paso de tutorial 'Toolbox y Mundos Premium' -> presente."
} else { Write-Warning "[FALTA] InicioBuilder.tsx: no encontre el paso de tutorial de '#inicio-dual'." }

$finalWb = [System.IO.File]::ReadAllText($fullWbPath)
if ($finalWb -match [regex]::Escape("selector: '#worlds-misiones'") -and $finalWb -match [regex]::Escape("selector: '#estrategia-plan-accion'")) {
    Write-Host "[OK] WorldsBuilder.tsx: pasos de tutorial 'misiones' y 'plan de accion' -> presentes."
} else { Write-Warning "[FALTA] WorldsBuilder.tsx: revisa los pasos de tutorial de misiones / plan de accion." }

Write-Host ""
Write-Host "Listo. Si todo dice [OK], sigue con: git add -A ; git commit -m 'Tutoriales: arregla avatar de Ecori en Convocatorias y agrega pasos faltantes' ; git push"
