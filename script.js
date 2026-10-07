// Attivazione dell'applicazione per il funzionamento offline su iPhone
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('Applicazione configurata con successo!'))
        .catch((err) => console.log('Errore configurazione app:', err));
}
document.addEventListener("DOMContentLoaded", () => {
    const svgObj = document.getElementById("mappa-svg");
    let svgDoc = null, dbJSON = [], queryBuffer = "", omoData = null, omoIndex = 0, supVis = false;

    fetch("dati.json").then(r => r.json()).then(d => dbJSON = d).catch(() => console.log("No JSON"));

    svgObj.addEventListener("load", () => {
        svgDoc = svgObj.contentDocument;
        if (svgDoc) {
            const sup = svgDoc.getElementById("superiore") || svgDoc.getElementById("SUPERIORE");
            if (sup) { sup.setAttribute("display", "none"); sup.style.setProperty("display", "none", "important"); }
            attivaInterfaccia();
        }
    });

    function attivaInterfaccia() {
        const tastiera = svgDoc.getElementById("tastiera");
        if (!tastiera) return;
        tastiera.style.cursor = "pointer";

        tastiera.addEventListener("click", (e) => {
            let target = e.target, gLettera = null, gSpeciale = null;
            let txtClick = target && target.textContent ? target.textContent.trim().toUpperCase() : "";

            while (target && target !== tastiera) {
                if (target.parentNode && target.parentNode.id === "lettere") gLettera = target;
                if (["ricerca", "risultato"].includes(target.id)) gSpeciale = target;
                target = target.parentNode;
            }

            if (gSpeciale && gSpeciale.id === "risultato" && omoData) {
                e.preventDefault(); e.stopPropagation();
                const box = e.target.getBBox ? e.target.getBBox() : { x: 0, width: 200 };
                const clickX = e.clientX - e.target.getBoundingClientRect().left;
                
                if (clickX < box.width / 3) {
                    omoIndex = (omoIndex - 1 + omoData.length) % omoData.length;
                    mostraOmonimoCorrente();
                } else if (clickX > (box.width * 2) / 3) {
                    omoIndex = (omoIndex + 1) % omoData.length;
                    mostraOmonimoCorrente();
                }
                return;
            }

            if (gLettera) {
                e.preventDefault(); e.stopPropagation();
                let idG = gLettera.id.replace(/_/g, "").trim().toUpperCase();
                let vTasto = idG;
                const nTxt = gLettera.querySelector("text");
                if (nTxt && nTxt.textContent) vTasto = nTxt.textContent.trim().toUpperCase();

                const isSpazio = idG.includes("SPAZIO") || idG.includes("SPACE") || vTasto === "SPAZIO" || txtClick === "SPAZIO";
                const isCanc = idG.includes("DEL") || idG.includes("DELETE") || vTasto === "DEL" || txtClick === "DEL";
                const isSu = idG === "SU" || vTasto === "SU" || txtClick === "SU";
                const isCancAll = idG.includes("CANC") || vTasto === "CANC" || txtClick === "CANC";

                const sf = gLettera.querySelector("path") || gLettera.querySelector("rect") || gLettera.querySelector("polygon") || gLettera;
                if (!sf.dataset.colOrig || sf.style.fill === "rgb(255, 0, 0)" || sf.style.fill === "#ff0000") {
                    let col = window.getComputedStyle(sf).fill;
                    if (col !== "rgb(255, 0, 0)" && col !== "#ff0000") sf.dataset.colOrig = col;
                }
                if (sf.dataset.tId) clearTimeout(parseInt(sf.dataset.tId));
                sf.style.fill = "#ff0000";
                sf.dataset.tId = setTimeout(() => { sf.style.fill = sf.dataset.colOrig || ""; sf.dataset.tId = ""; }, 200);

                if (isSu) { invertiSup(gLettera); }
                else if (isCancAll) { resettaMappa(); }
                else if (vTasto === "INVIO" || vTasto === "ENTER" || txtClick === "INVIO") { if (queryBuffer.trim() !== "") eseguiRicerca(queryBuffer.trim()); }
                else if (isCanc) { queryBuffer = queryBuffer.slice(0, -1); omoData = null; aggBarra(); scriviRis(""); }
                else if (isSpazio) { queryBuffer += " "; omoData = null; aggBarra(); }
                else { queryBuffer += vTasto; omoData = null; aggBarra(); }
            }
            if (gSpeciale && gSpeciale.id === "ricerca") { e.preventDefault(); e.stopPropagation(); queryBuffer = queryBuffer.slice(0, -1); omoData = null; aggBarra(); }
            if (gSpeciale && gSpeciale.id === "risultato" && !omoData) { e.preventDefault(); e.stopPropagation(); resettaMappa(); }
        }, true);
    }

    function invertiSup(pSu) {
        supVis = !supVis;
        svgDoc.querySelectorAll("g").forEach(el => {
            if (el.id && el.id.toLowerCase().includes("superiore") && !el.closest("#tastiera")) {
                el.style.setProperty("display", supVis ? "inline" : "none", "important");
                if (supVis) el.style.setProperty("visibility", "visible", "important");
            }
        });
        const fr = pSu.querySelector("#SU") || pSu.querySelector("path") || pSu.querySelector("polygon") || pSu;
        if (fr) {
            const b = fr.getBBox(); const cX = b.x + b.width / 2; const cY = b.y + b.height / 2;
            if (supVis) fr.setAttribute("transform", `translate(${cX}, ${cY}) scale(1, -1) translate(${-cX}, ${-cY})`);
            else fr.removeAttribute("transform");
        }
    }

    function aggBarra() {
        const g = svgDoc.getElementById("ricerca");
        if (g) { const t = g.querySelector("text"); if (t) t.textContent = queryBuffer.length > 0 ? queryBuffer : "INSERISCI DA CERCARE..."; }
    }

    function eseguiRicerca(q) {
        let parole = q.toLowerCase().split(/\s+/).filter(p => p.length > 0);
        if (parole.length === 0) return;

        // CORREZIONE: Controlla se la query corrisponde a un ID pulito nell'SVG o ai dati testuali del JSON
        const trovati = dbJSON.filter(item => {
            return parole.every(p => {
                let nelJson = Object.values(item).join(" ").toLowerCase().includes(p);
                let chiaveId = Object.keys(item).find(k => k.toLowerCase().includes("codice") || k.toLowerCase().includes("pos") || k.toLowerCase().includes("id")) || Object.keys(item)[Object.keys(item).length - 1];
                let valoreId = String(item[chiaveId]).toLowerCase();
                let nellId = valoreId.includes(p) || p.includes(valoreId);
                return nelJson || nellId;
            });
        });
        
        // Se non trova corrispondenze nel JSON ma l'ID esiste fisicamente nell'SVG, crea un record fittizio al volo per non bloccarsi
        if (trovati.length === 0) {
            let elFisico = svgDoc.getElementById(q.toLowerCase()) || svgDoc.getElementById(q.toUpperCase());
            if (elFisico) {
                omoData = null;
                mostraFinale({ id: q.toLowerCase() });
                return;
            }
            scriviRis("NESSUN RISULTATO PER: " + q.toUpperCase()); 
        } else if (trovati.length === 1) { 
            omoData = null; 
            mostraFinale(trovati[0]); 
        } else {
            omoData = trovati; omoIndex = 0; mostraOmonimoCorrente();
        }
    }

    function mostraOmonimoCorrente() {
        if (!omoData || !omoData[omoIndex]) return;
        const trovato = omoData[omoIndex];
        const chiavi = Object.keys(trovato);
        
        let n = trovato[chiavi.find(k => k.toLowerCase() === "nascita")] || "";
        let m = trovato[chiavi.find(k => k.toLowerCase() === "morte")] || "";
        let id = String(trovato[chiavi.find(k => k.toLowerCase().includes("codice") || k.toLowerCase().includes("pos") || k.toLowerCase().includes("id")) || chiavi[chiavi.length - 1]]).trim().toLowerCase();

        let posEstesa = id;
        let match = id.match(/c(\d+)t(\d+)/i);
        if (match) posEstesa = `CAMPO ${match[1]} TOMBA ${match[2]}`;

        scriviRis(`◀  [${omoIndex + 1}/${omoData.length}]  N.${n} M.${m}  ${posEstesa}  ▶`.toUpperCase());
        let el = svgDoc.getElementById(id) || svgDoc.getElementById(id.toUpperCase());
        if (el) spostaBollo(el);
    }

    function mostraFinale(trovato) {
        const chiavi = Object.keys(trovato);
        let n = trovato[chiavi.find(k => k.toLowerCase() === "nascita")] || "";
        let m = trovato[chiavi.find(k => k.toLowerCase() === "morte")] || "";
        let id = String(trovato[chiavi.find(k => k.toLowerCase().includes("codice") || k.toLowerCase().includes("pos") || k.toLowerCase().includes("id")) || chiavi[chiavi.length - 1]]).trim().toLowerCase();

        let posEstesa = id;
        let match = id.match(/c(\d+)t(\d+)/i);
        if (match) posEstesa = `CAMPO ${match[1]} TOMBA ${match[2]}`;

        scriviRis(`N.${n} M.${m} ${posEstesa}`.trim().toUpperCase());
        let el = svgDoc.getElementById(id) || svgDoc.getElementById(id.toUpperCase());
        if (el) spostaBollo(el);
    }

    function spostaBollo(el) {
        const bollo = svgDoc.getElementById("bollo"); if (!bollo) return;
        const bT = el.getBBox(); bollo.style.display = "block"; bollo.classList.add("bollo-pulse"); const bB = bollo.getBBox();
        bollo.setAttribute("transform", `translate(${(bT.x + bT.width / 2) - (bB.x + bB.width / 2)}, ${(bT.y + bT.height / 2) - (bB.y + bB.height / 2)})`);
    }

    function scriviRis(m) { const g = svgDoc.getElementById("risultato"); if (g) { const t = g.querySelector("text"); if (t) t.textContent = m; } }

    function resettaMappa() {
        const bollo = svgDoc.getElementById("bollo"); if (bollo) { bollo.style.display = "none"; bollo.removeAttribute("transform"); }
        queryBuffer = ""; omoData = null; omoIndex = 0; aggBarra(); scriviRis("");
    }
});
