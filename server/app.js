const express = require('express');
const cors = require('cors');
const fs = require('fs'); // File System module for permanent storage
const app = express();
const PORT = 5000;
const DB_FILE = './database.json';
const TODO_FILE = './to_do.json';


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // <-- AGGIUNGI QUESTA RIGA

const loadToDo = () => {
    try {
        if (!fs.existsSync(TODO_FILE)) {
            fs.writeFileSync(TODO_FILE, JSON.stringify([]));
            return [];
        }
        const data = fs.readFileSync(TODO_FILE, 'utf8');
        // Se il file è vuoto (0 byte), ritorna array vuoto invece di crashare
        if (!data.trim()) return []; 
        return JSON.parse(data);
    } catch (error) {
        console.error("Errore nel formato di to_do.json:", error);
        return []; // Ritorna vuoto invece di rompere il server
    }
};
// Helper function to load activities from the JSON file
const loadActivities = () => {
    try {
        if (!fs.existsSync(DB_FILE)) return [];
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading database file:", error);
        return [];
    }
};

// Helper function to save activities to the JSON file
const saveActivities = (data) => {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("Error saving to database file:", error);
    }
};

// Initial load of activities
let activities = loadActivities();

// --- API ROUTES ---
// Questa è la rotta che il client React cerca per vedere le attività
app.get('/api/activities', (req, res) => {
    // Carichiamo i dati aggiornati dal file database.json
    const activities = loadActivities(); 
    res.json(activities);
});
// Route to receive new activities from technicians
app.post('/api/activities', (req, res) => {
    // Controllo di sicurezza: se il body è vuoto, non fare nulla
    if (!req.body || !req.body.technicianName) {
        return res.status(400).json({ error: "Missing technician name" });
    }

    const { technicianName, date, hours } = req.body;
    const newHours = Number(hours);

    // Controllo conflitti (massimo 8 ore al giorno)
    const currentTotalHours = activities
        .filter(a => a.technicianName === technicianName && a.date === date)
        .reduce((sum, a) => sum + Number(a.hours), 0);

    const { todo_task } = req.body;

    if (todo_task) {
        let currentTodo = loadToDo();
        // Rimuoviamo il task assegnato dalla lista dei "da fare"
        currentTodo = currentTodo.filter(t => t.id !== todo_task);
        fs.writeFileSync(TODO_FILE, JSON.stringify(currentTodo, null, 2));
    }    
    if (currentTotalHours + newHours > 8) {
        // Se la richiesta viene dal form Admin (HTML), mandiamo un avviso semplice
        if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
            return res.send(`
                <script>
                    alert("CONFLITTO: ${technicianName} ha già ${currentTotalHours}h il ${date}.");
                    window.location.href = '/admin';
                </script>
            `);
        }
        // Se viene dal client React, mandiamo il JSON
        return res.status(400).json({ 
            error: `Conflict: ${technicianName} has ${currentTotalHours}h planned.` 
        });
    }

    const newEntry = {
        id: Date.now(),
        technicianName,
        date,
        type: req.body.type || 'DEVELOPMENT',
        hours: newHours,
        reference: req.body.reference || '',
        description: req.body.description || '',
        createdAt: new Date().toISOString()
    };
    
    activities.push(newEntry);
    saveActivities(activities);
    
    // Se la richiesta viene dall'Admin form, ricarica la pagina admin
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
        return res.redirect('/admin');
    }
    
    res.status(201).json(newEntry);
});

// Route for CSV Export
app.get('/api/export', (req, res) => {
    if (activities.length === 0) return res.status(404).send("No data to export");
    
    const headers = "Technician,Date,Type,Hours,Reference,Description\n";
    const rows = activities.map(a => 
        `"${a.technicianName}",${a.date},${a.type},${a.hours},"${a.reference}","${a.description}"`
    ).join("\n");
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=export.csv');
    res.send(headers + rows);
});

app.get('/admin', (req, res) => {
    const { technician, startDate, endDate } = req.query;
    const todoList = loadToDo(); // Carica le attività da assegnare

    // 1. Estrai la lista UNICA dei tecnici per i suggerimenti nel filtro
    const technicianList = [...new Set(activities.map(a => a.technicianName))];

    // 2. Logica di filtraggio
    let filtered = activities;
    if (technician) {
        filtered = filtered.filter(a => a.technicianName === technician);
    }
    if (startDate) filtered = filtered.filter(a => a.date >= startDate);
    if (endDate) filtered = filtered.filter(a => a.date <= endDate);

    // 3. Dati per Gantt e Calendario
    const ganttData = filtered.map(a => [
        a.id.toString(), a.technicianName, a.type,
        new Date(a.date), new Date(a.date), null, 100, null
    ]);

    const calendarEvents = filtered.map(a => ({
        title: `${a.technicianName}: ${a.hours}h`,
        start: a.date,
        backgroundColor: a.type === 'DEVELOPMENT' ? '#3788d8' : a.type === 'LEAVE' ? '#28a745' : '#f39c12'
    }));

    res.send(`
        <html>
            <head>
                <title>Admin Control Panel</title>
                <script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
                <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.js'></script>
                <style>
                    body { font-family: 'Segoe UI', sans-serif; margin: 0; display: flex; background: #f0f2f5; }
                    .sidebar { width: 320px; background: #2c3e50; color: white; padding: 20px; height: 100vh; position: fixed; box-sizing: border-box; }
                    .main-content { margin-left: 320px; padding: 20px; width: calc(100% - 320px); }
                    .card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); margin-bottom: 25px; color: #333; }
                    select, input, button { width: 100%; padding: 12px; margin: 8px 0; border-radius: 6px; border: 1px solid #ddd; display: block; box-sizing: border-box; }
                    button { background: #3498db; color: white; border: none; font-weight: bold; cursor: pointer; transition: 0.3s; }
                    button:hover { background: #2980b9; }
                    h2 { font-size: 1.2rem; border-bottom: 1px solid #555; padding-bottom: 10px; margin-top: 20px; }
                    #calendar { height: 600px; }
                </style>
            </head>
            <body>
                <div class="sidebar">
                    <h1>Admin Dashboard</h1>
                    
                    <h2>🔍 Filters</h2>
                    <form method="GET" action="/admin">
                        <label>Select Technician:</label>
                        <select name="technician">
                            <option value="">-- All Technicians --</option>
                            ${technicianList.map(t => `<option value="${t}" ${technician === t ? 'selected' : ''}>${t}</option>`).join('')}
                        </select>
                        <input type="date" name="startDate" value="${startDate || ''}">
                        <input type="date" name="endDate" value="${endDate || ''}">
                        <button type="submit">Apply Filters</button>
                        <button type="button" onclick="window.location.href='/admin'" style="background:#7f8c8d">Reset View</button>
                    </form>

                    <!-- Nella sidebar, sotto Quick Assign, sostituisci il form con questo -->
                    <h2>➕ Assign Planned Task</h2>
                    <form action="/api/activities" method="POST">
                        <input type="text" name="technicianName" placeholder="Technician Name" required>
                        <input type="date" name="date" required>
                        
                        <label>Select Task from Backlog:</label>
                        <select name="todo_task" onchange="fillTaskDetails(this)">
                            <option value="">-- Select a Task --</option>
                            ${todoList.map(t => `<option value="${t.id}" data-ref="${t.reference}" data-desc="${t.description}">${t.reference} - ${t.description}</option>`).join('')}
                        </select>

                        <!-- Campi nascosti o pre-compilati -->
                        <input type="hidden" id="hidden_ref" name="reference">
                        <input type="hidden" id="hidden_desc" name="description">
                        
                        <select name="type">
                            <option value="DEVELOPMENT">Development</option>
                            <option value="TRIP">Trip</option>
                        </select>
                        <input type="number" name="hours" value="8">
                        <button type="submit" style="background:#2ecc71">Assign to Tech</button>
                    </form>
                </div>

                <div class="main-content">
                    <div class="card">
                        <h3>📊 Gantt Timeline</h3>
                        <div id="chart_div" style="min-height: 250px;"></div>
                    </div>

                    <div class="card">
                        <h3>📅 Monthly Calendar</h3>
                        <div id="calendar"></div>
                    </div>
                </div>

                <script>
                    // GOOGLE GANTT
                    google.charts.load('current', {'packages':['gantt']});
                    google.charts.setOnLoadCallback(() => {
                        var data = new google.visualization.DataTable();
                        data.addColumn('string', 'ID'); data.addColumn('string', 'Name');
                        data.addColumn('string', 'Resource'); data.addColumn('date', 'Start');
                        data.addColumn('date', 'End'); data.addColumn('number', 'Duration');
                        data.addColumn('number', 'Percent'); data.addColumn('string', 'Dep');
                        
                        const raw = ${JSON.stringify(ganttData)};
                        const rows = raw.map(r => { 
                            r[3] = new Date(r[3]); r[4] = new Date(r[4]); 
                            r[4].setHours(23,59,59); return r; 
                        });
                        data.addRows(rows);
                        new google.visualization.Gantt(document.getElementById('chart_div')).draw(data, { height: 250 });
                    });

                    // FULLCALENDAR
                    document.addEventListener('DOMContentLoaded', function() {
                        var calendarEl = document.getElementById('calendar');
                        var calendar = new FullCalendar.Calendar(calendarEl, {
                            initialView: 'dayGridMonth',
                            events: ${JSON.stringify(calendarEvents)},
                            headerToolbar: { left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek' }
                        });
                        calendar.render();
                    });
                    function fillTaskDetails(select) {
                        const selectedOption = select.options[select.selectedIndex];
                        document.getElementById('hidden_ref').value = selectedOption.getAttribute('data-ref') || '';
                        document.getElementById('hidden_desc').value = selectedOption.getAttribute('data-desc') || '';
                        }
                </script>
            </body>
        </html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});