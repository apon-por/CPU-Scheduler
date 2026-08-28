// ════════════════════════════════════════════════════════
//  CPU Scheduling Simulator — script.js
//  Algorithms: FCFS, SJF, SRTF, Priority, Round Robin
//  Premium UI with Compare All & Gantt Tooltips
// ════════════════════════════════════════════════════════

const COLORS = [
    '#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6',
    '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#a855f7'
];
const IDLE_COLOR = 'rgba(255,255,255,0.08)';

const ALGO_DESC = {
    fcfs:     'Processes are executed in the order they arrive. Simple, non-preemptive, and easy to implement.',
    sjf:      'Selects the process with the shortest burst time from the ready queue. Non-preemptive — once started, it runs to completion.',
    srtf:     'Preemptive version of SJF. If a new process arrives with a shorter remaining time, it preempts the current one.',
    priority: 'Selects the highest-priority process (lowest number) from the ready queue. Non-preemptive.',
    rr:       'Each process gets a fixed time slice (quantum) in cyclic order. Fair and preemptive.'
};

const ALGO_TITLES = {
    fcfs:     'FCFS (First Come First Serve)',
    sjf:      'SJF (Shortest Job First)',
    srtf:     'SRTF (Shortest Remaining Time First)',
    priority: 'Priority Scheduling',
    rr:       'Round Robin'
};

let processCounter = 0;

// ═══════════════ INIT ═══════════════

document.addEventListener('DOMContentLoaded', () => {
    addProcess(0, 5, 2);
    addProcess(1, 3, 1);
    addProcess(2, 8, 3);
    addProcess(3, 6, 4);

    document.getElementById('addProcessBtn').addEventListener('click', () => addProcess());
    document.getElementById('algorithm').addEventListener('change', onAlgoChange);
    document.getElementById('calculateBtn').addEventListener('click', calculate);
    document.getElementById('compareBtn').addEventListener('click', compareAll);

    onAlgoChange();
});

// ═══════════════ PROCESS TABLE ═══════════════

function addProcess(at = 0, bt = 1, pr = 1) {
    processCounter++;
    const tbody = document.getElementById('processBody');
    const tr = document.createElement('tr');
    const colorIdx = (processCounter - 1) % COLORS.length;
    tr.innerHTML = `
        <td class="pid-cell">
            <span class="badge" style="background:${COLORS[colorIdx]}">P${processCounter}</span>
        </td>
        <td><input type="number" class="input-at" value="${at}" min="0"></td>
        <td><input type="number" class="input-bt" value="${bt}" min="1"></td>
        <td><input type="number" class="input-pr" value="${pr}" min="1"></td>
        <td><button class="btn btn-remove" onclick="removeProcess(this)">✕</button></td>
    `;
    tbody.appendChild(tr);
}

function removeProcess(btn) {
    const tbody = document.getElementById('processBody');
    if (tbody.rows.length > 1) {
        btn.closest('tr').remove();
        // Renumber
        Array.from(tbody.rows).forEach((row, i) => {
            const badge = row.querySelector('.badge');
            badge.textContent = `P${i + 1}`;
            badge.style.background = COLORS[i % COLORS.length];
        });
    }
}

function onAlgoChange() {
    const algo = document.getElementById('algorithm').value;
    document.getElementById('quantumGroup').style.display = algo === 'rr' ? 'flex' : 'none';
    document.getElementById('algoDesc').textContent = ALGO_DESC[algo] || '';
}

function readProcesses() {
    const rows = document.querySelectorAll('#processBody tr');
    return Array.from(rows).map((row, i) => ({
        id: i,
        name: `P${i + 1}`,
        at: Math.max(0, parseInt(row.querySelector('.input-at').value) || 0),
        bt: Math.max(1, parseInt(row.querySelector('.input-bt').value) || 1),
        pr: Math.max(1, parseInt(row.querySelector('.input-pr').value) || 1)
    }));
}

// ═══════════════ CALCULATE ═══════════════

function calculate() {
    const processes = readProcesses();
    if (processes.length === 0) return;

    const algo = document.getElementById('algorithm').value;
    const quantum = Math.max(1, parseInt(document.getElementById('quantum').value) || 2);

    const result = runAlgo(algo, processes, quantum);

    document.getElementById('algoTitle').textContent = ALGO_TITLES[algo];
    document.getElementById('compareSection').style.display = 'none';
    showResults(result, processes);
}

function runAlgo(algo, processes, quantum) {
    switch (algo) {
        case 'fcfs':     return scheduleFCFS(processes);
        case 'sjf':      return scheduleSJF(processes);
        case 'srtf':     return scheduleSRTF(processes);
        case 'priority': return schedulePriority(processes);
        case 'rr':       return scheduleRR(processes, quantum);
    }
}

function compareAll() {
    const processes = readProcesses();
    if (processes.length === 0) return;

    const quantum = Math.max(1, parseInt(document.getElementById('quantum').value) || 2);

    const algorithms = [
        { key: 'fcfs',     name: 'FCFS — First Come First Serve' },
        { key: 'sjf',      name: 'SJF — Shortest Job First' },
        { key: 'srtf',     name: 'SRTF — Shortest Remaining Time First' },
        { key: 'priority', name: 'Priority Scheduling' },
        { key: 'rr',       name: `Round Robin (Q=${quantum})` }
    ];

    const results = algorithms.map(a => ({
        ...a,
        result: runAlgo(a.key, processes, quantum)
    }));

    // Hide single results
    document.getElementById('resultsSection').style.display = 'none';

    // Show comparison
    showComparison(results, processes);
}

// ════════════════════════════════════════════
//            SCHEDULING ALGORITHMS
// ════════════════════════════════════════════

function scheduleFCFS(processes) {
    const sorted = [...processes].sort((a, b) => a.at - b.at || a.id - b.id);
    const gantt = [];
    const data = {};
    let t = 0;

    for (const p of sorted) {
        if (t < p.at) {
            gantt.push({ name: 'Idle', start: t, end: p.at, idle: true });
            t = p.at;
        }
        gantt.push({ name: p.name, id: p.id, start: t, end: t + p.bt });
        data[p.id] = { ct: t + p.bt, rt: t - p.at };
        t += p.bt;
    }
    return { gantt, data };
}

function scheduleSJF(processes) {
    const n = processes.length;
    const done = new Set();
    const gantt = [];
    const data = {};
    let t = 0;

    while (done.size < n) {
        const avail = processes.filter(p => p.at <= t && !done.has(p.id));
        if (avail.length === 0) {
            const next = Math.min(...processes.filter(p => !done.has(p.id)).map(p => p.at));
            gantt.push({ name: 'Idle', start: t, end: next, idle: true });
            t = next;
            continue;
        }
        avail.sort((a, b) => a.bt - b.bt || a.at - b.at || a.id - b.id);
        const sel = avail[0];
        gantt.push({ name: sel.name, id: sel.id, start: t, end: t + sel.bt });
        data[sel.id] = { ct: t + sel.bt, rt: t - sel.at };
        t += sel.bt;
        done.add(sel.id);
    }
    return { gantt, data };
}

function scheduleSRTF(processes) {
    const n = processes.length;
    const rem = processes.map(p => p.bt);
    const firstResp = new Array(n).fill(-1);
    const ct = new Array(n).fill(0);
    const timeline = [];
    let done = 0, t = 0;
    const maxEnd = Math.max(...processes.map(p => p.at)) + processes.reduce((s, p) => s + p.bt, 0);

    while (done < n && t <= maxEnd + 1) {
        const avail = processes.filter(p => p.at <= t && rem[p.id] > 0);
        if (avail.length === 0) {
            timeline.push({ idle: true, t });
            t++;
            continue;
        }
        avail.sort((a, b) => rem[a.id] - rem[b.id] || a.at - b.at || a.id - b.id);
        const sel = avail[0];
        if (firstResp[sel.id] === -1) firstResp[sel.id] = t;
        timeline.push({ name: sel.name, id: sel.id, t });
        rem[sel.id]--;
        if (rem[sel.id] === 0) { ct[sel.id] = t + 1; done++; }
        t++;
    }

    const gantt = compressTimeline(timeline);
    const data = {};
    processes.forEach(p => {
        data[p.id] = { ct: ct[p.id], rt: firstResp[p.id] - p.at };
    });
    return { gantt, data };
}

function schedulePriority(processes) {
    const n = processes.length;
    const done = new Set();
    const gantt = [];
    const data = {};
    let t = 0;

    while (done.size < n) {
        const avail = processes.filter(p => p.at <= t && !done.has(p.id));
        if (avail.length === 0) {
            const next = Math.min(...processes.filter(p => !done.has(p.id)).map(p => p.at));
            gantt.push({ name: 'Idle', start: t, end: next, idle: true });
            t = next;
            continue;
        }
        avail.sort((a, b) => a.pr - b.pr || a.at - b.at || a.id - b.id);
        const sel = avail[0];
        gantt.push({ name: sel.name, id: sel.id, start: t, end: t + sel.bt });
        data[sel.id] = { ct: t + sel.bt, rt: t - sel.at };
        t += sel.bt;
        done.add(sel.id);
    }
    return { gantt, data };
}

function scheduleRR(processes, quantum) {
    const n = processes.length;
    const sorted = [...processes].sort((a, b) => a.at - b.at || a.id - b.id);
    const rem = {};
    const firstResp = {};
    const ct = {};
    sorted.forEach(p => { rem[p.id] = p.bt; });

    const queue = [];
    const gantt = [];
    let t = 0, idx = 0, done = 0;

    while (idx < n && sorted[idx].at <= t) { queue.push(sorted[idx]); idx++; }

    while (done < n) {
        if (queue.length === 0) {
            if (idx >= n) break;
            gantt.push({ name: 'Idle', start: t, end: sorted[idx].at, idle: true });
            t = sorted[idx].at;
            while (idx < n && sorted[idx].at <= t) { queue.push(sorted[idx]); idx++; }
            continue;
        }

        const cur = queue.shift();
        if (firstResp[cur.id] === undefined) firstResp[cur.id] = t;

        const exec = Math.min(quantum, rem[cur.id]);
        gantt.push({ name: cur.name, id: cur.id, start: t, end: t + exec });
        t += exec;
        rem[cur.id] -= exec;

        while (idx < n && sorted[idx].at <= t) { queue.push(sorted[idx]); idx++; }

        if (rem[cur.id] > 0) {
            queue.push(cur);
        } else {
            ct[cur.id] = t;
            done++;
        }
    }

    const data = {};
    processes.forEach(p => {
        data[p.id] = { ct: ct[p.id], rt: firstResp[p.id] - p.at };
    });
    return { gantt, data };
}

// ═══════════════ HELPERS ═══════════════

function compressTimeline(timeline) {
    if (timeline.length === 0) return [];
    const gantt = [];
    let cur = {
        name: timeline[0].name || 'Idle',
        id: timeline[0].id,
        start: timeline[0].t,
        end: timeline[0].t + 1,
        idle: !!timeline[0].idle
    };

    for (let i = 1; i < timeline.length; i++) {
        const e = timeline[i];
        const name = e.name || 'Idle';
        const isIdle = !!e.idle;
        if (name === cur.name && isIdle === cur.idle) {
            cur.end = e.t + 1;
        } else {
            gantt.push(cur);
            cur = { name, id: e.id, start: e.t, end: e.t + 1, idle: isIdle };
        }
    }
    gantt.push(cur);
    return gantt;
}

// ════════════════════════════════════════════
//             DISPLAY / RENDERING
// ════════════════════════════════════════════

function showResults(result, processes) {
    const section = document.getElementById('resultsSection');
    section.style.display = 'block';
    section.classList.remove('fade-in');
    void section.offsetWidth; // reflow trigger
    section.classList.add('fade-in');

    renderGanttChart(result.gantt);
    renderResultTable(result.data, processes);

    setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
}

function renderGanttChart(gantt) {
    const container = document.getElementById('ganttChart');
    container.innerHTML = '';
    if (gantt.length === 0) return;

    gantt.forEach((block, i) => {
        const dur = block.end - block.start;
        const width = Math.max(54, dur * 46);
        const color = block.idle ? IDLE_COLOR : COLORS[block.id % COLORS.length];

        const seg = document.createElement('div');
        seg.className = 'gantt-seg';
        seg.style.width = width + 'px';
        seg.style.animationDelay = `${i * 0.06}s`;

        const tooltipText = block.idle
            ? `<strong>CPU Idle</strong><br>Time: ${block.start} → ${block.end} (${dur} units)`
            : `<strong>${block.name}</strong><br>Time: ${block.start} → ${block.end} (${dur} units)`;

        let html = `
            <div class="gantt-bar" style="background:${color};${block.idle ? 'color:var(--text-3);font-weight:500;' : ''}">
                ${block.idle ? 'Idle' : block.name}
            </div>
            <div class="gantt-tooltip">${tooltipText}</div>
            <span class="gantt-tick">${block.start}</span>
        `;

        if (i === gantt.length - 1) {
            html += `<span class="gantt-tick gantt-tick-end">${block.end}</span>`;
        }

        seg.innerHTML = html;
        container.appendChild(seg);
    });
}

function renderResultTable(data, processes) {
    const tbody = document.getElementById('resultBody');
    tbody.innerHTML = '';

    let sumTAT = 0, sumWT = 0, sumRT = 0;

    processes.forEach(p => {
        const d = data[p.id];
        const tat = d.ct - p.at;
        const wt = tat - p.bt;

        sumTAT += tat;
        sumWT += wt;
        sumRT += d.rt;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="badge" style="background:${COLORS[p.id % COLORS.length]}">${p.name}</span></td>
            <td>${p.at}</td>
            <td>${p.bt}</td>
            <td>${p.pr}</td>
            <td class="cell-ct">${d.ct}</td>
            <td class="cell-tat">${tat}</td>
            <td class="cell-wt">${wt}</td>
            <td class="cell-rt">${d.rt}</td>
        `;
        tbody.appendChild(tr);
    });

    const n = processes.length;
    document.getElementById('avgTAT').textContent = (sumTAT / n).toFixed(2);
    document.getElementById('avgWT').textContent = (sumWT / n).toFixed(2);
    document.getElementById('avgRT').textContent = (sumRT / n).toFixed(2);
}

// ═══════════════ COMPARE ALL ═══════════════

function showComparison(results, processes) {
    const section = document.getElementById('compareSection');
    section.style.display = 'block';
    section.classList.remove('fade-in');
    void section.offsetWidth;
    section.classList.add('fade-in');

    const tbody = document.getElementById('compareBody');
    tbody.innerHTML = '';

    // Calculate averages
    const rows = results.map(r => {
        const n = processes.length;
        let sumTAT = 0, sumWT = 0, sumRT = 0;
        processes.forEach(p => {
            const d = r.result.data[p.id];
            const tat = d.ct - p.at;
            const wt = tat - p.bt;
            sumTAT += tat;
            sumWT += wt;
            sumRT += d.rt;
        });
        return {
            name: r.name,
            key: r.key,
            avgTAT: sumTAT / n,
            avgWT: sumWT / n,
            avgRT: sumRT / n
        };
    });

    // Find best (minimum) values
    const bestTAT = Math.min(...rows.map(r => r.avgTAT));
    const bestWT  = Math.min(...rows.map(r => r.avgWT));
    const bestRT  = Math.min(...rows.map(r => r.avgRT));

    rows.forEach(r => {
        const tr = document.createElement('tr');
        const isBestTAT = Math.abs(r.avgTAT - bestTAT) < 0.001;
        const isBestWT  = Math.abs(r.avgWT  - bestWT)  < 0.001;
        const isBestRT  = Math.abs(r.avgRT  - bestRT)  < 0.001;

        tr.innerHTML = `
            <td style="text-align:left;font-weight:600;color:var(--text-1);">${r.name}</td>
            <td class="${isBestTAT ? 'best-cell' : 'cell-tat'}">${r.avgTAT.toFixed(2)}</td>
            <td class="${isBestWT  ? 'best-cell' : 'cell-wt'}">${r.avgWT.toFixed(2)}</td>
            <td class="${isBestRT  ? 'best-cell' : 'cell-rt'}">${r.avgRT.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('compareNote').innerHTML =
        '<span class="star">★</span> Best value for each metric is highlighted in green.';

    setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
}
