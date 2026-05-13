const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// --- DATABASE CONFIGURATION ---
// Railway provides DATABASE_URL automatically in the environment
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Initialize Database Tables
const initDb = async () => {
    try {
        // Table for technician activities
        await pool.query(`
            CREATE TABLE IF NOT EXISTS activities (
                id BIGINT PRIMARY KEY,
                technician_name TEXT,
                date DATE,
                type TEXT,
                hours INTEGER,
                reference TEXT,
                description TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
        `);
        console.log("PostgreSQL Tables Ready");
    } catch (err) {
        console.error("Database Init Error:", err);
    }
};
initDb();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- API ROUTES ---

// GET: Fetch all activities from DB
app.get('/api/activities', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM activities ORDER BY date DESC');
        // Map database snake_case to frontend camelCase
        const activities = result.rows.map(row => ({
            id: row.id,
            technicianName: row.technician_name,
            date: row.date.toISOString().split('T')[0],
            type: row.type,
            hours: row.hours,
            reference: row.reference,
            description: row.description,
            createdAt: row.created_at
        }));
        res.json(activities);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST: Save new activity to DB
app.post('/api/activities', async (req, res) => {
    const { technicianName, date, hours, type, reference, description } = req.body;
    const id = Date.now();

    try {
        await pool.query(
            'INSERT INTO activities (id, technician_name, date, type, hours, reference, description) VALUES ($1, $2, $3, $4, $5, $6, $7)',
            [id, technicianName, date, type, hours, reference, description]
        );

        if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
            return res.redirect('/admin');
        }
        res.status(201).json({ id, message: "Activity saved to PostgreSQL" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- INTERFACES ---

// 1. ADMIN DASHBOARD (Gantt + Global Calendar)
app.get('/admin', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM activities');
        const activities = result.rows;

        const technicianList = [...new Set(activities.map(a => a.technician_name))];
        const calendarEvents = activities.map(a => ({
            title: `${a.technician_name}: ${a.hours}h`,
            start: a.date.toISOString().split('T')[0],
            backgroundColor: a.type === 'DEVELOPMENT' ? '#3788d8' : a.type === 'LEAVE' ? '#28a745' : '#f39c12'
        }));

        res.send(`
            <html>
            <head>
                <title>Admin Dashboard</title>
                <script src="https://www.gstatic.com/charts/loader.js"></script>
                <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.js'></script>
                <style>
                    body { font-family: sans-serif; display: flex; background: #f4f7f6; margin: 0; }
                    .sidebar { width: 300px; background: #2c3e50; color: white; padding: 20px; height: 100vh; }
                    .main { flex: 1; padding: 20px; }
                    .card { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    input, select, button { width: 100%; padding: 10px; margin: 10px 0; }
                    button { background: #3498db; color: white; border: none; cursor: pointer; }
                </style>
            </head>
            <body>
                <div class="sidebar">
                    <h2>Admin Panel</h2>
                    <form action="/api/activities" method="POST">
                        <input type="text" name="technicianName" placeholder="Technician Name" required>
                        <input type="date" name="date" required>
                        <select name="type">
                            <option value="DEVELOPMENT">Development</option>
                            <option value="TRIP">Trip</option>
                        </select>
                        <input type="number" name="hours" value="8">
                        <button type="submit">Quick Assign</button>
                    </form>
                </div>
                <div class="main">
                    <div class="card"><h3>📅 Global Calendar</h3><div id="calendar"></div></div>
                </div>
                <script>
                    document.addEventListener('DOMContentLoaded', function() {
                        var calendarEl = document.getElementById('calendar');
                        var calendar = new FullCalendar.Calendar(calendarEl, {
                            initialView: 'dayGridMonth',
                            events: ${JSON.stringify(calendarEvents)}
                        });
                        calendar.render();
                    });
                </script>
            </body>
            </html>
        `);
    } catch (err) { res.status(500).send(err.message); }
});

// 2. TECHNICIAN PORTAL (Client)
app.get('/client', (req, res) => {
    res.send(`
        <html>
        <head>
            <title>Technician Portal</title>
            <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.8/index.global.min.js'></script>
            <style>
                body { font-family: sans-serif; padding: 20px; background: #eceff1; }
                .container { display: flex; gap: 20px; }
                .form-box { width: 350px; background: #37474f; color: white; padding: 20px; border-radius: 10px; }
                .calendar-box { flex: 1; background: white; padding: 20px; border-radius: 10px; }
                input, select, textarea, button { width: 100%; padding: 10px; margin: 8px 0; border-radius: 4px; border: none; }
                button { background: #00bcd4; color: white; font-weight: bold; cursor: pointer; }
            </style>
        </head>
        <body>
            <h1>Technician Portal</h1>
            <div class="container">
                <div class="form-box">
                    <h3>Log Your Activity</h3>
                    <input type="text" id="techName" placeholder="Your Name">
                    <input type="date" id="date">
                    <select id="type">
                        <option value="DEVELOPMENT">Development</option>
                        <option value="TRIP">Trip</option>
                        <option value="LEAVE">Leave</option>
                    </select>
                    <input type="number" id="hours" value="8">
                    <input type="text" id="ref" placeholder="Project / Destination">
                    <textarea id="desc" placeholder="Notes"></textarea>
                    <button onclick="saveData()">Save Activity</button>
                </div>
                <div class="calendar-box">
                    <div id="calendar"></div>
                </div>
            </div>
            <script>
                let calendar;
                const techInput = document.getElementById('techName');
                techInput.value = localStorage.getItem('technicianName') || '';

                document.addEventListener('DOMContentLoaded', function() {
                    calendar = new FullCalendar.Calendar(document.getElementById('calendar'), {
                        initialView: 'dayGridMonth',
                        events: '/api/activities',
                        eventDataTransform: function(ev) {
                            if (ev.technicianName.toLowerCase() !== techInput.value.toLowerCase()) return false;
                            return { title: ev.hours + 'h - ' + ev.type, start: ev.date };
                        }
                    });
                    calendar.render();
                });

                async function saveData() {
                    const data = {
                        technicianName: techInput.value,
                        date: document.getElementById('date').value,
                        type: document.getElementById('type').value,
                        hours: document.getElementById('hours').value,
                        reference: document.getElementById('ref').value,
                        description: document.getElementById('desc').value
                    };
                    localStorage.setItem('technicianName', techInput.value);
                    const res = await fetch('/api/activities', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(data)
                    });
                    if(res.ok) { alert("Saved!"); calendar.refetchEvents(); }
                }
            </script>
        </body>
        </html>
    `);
});

app.get('/', (req, res) => res.redirect('/client'));

// --- START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
    console.log("Server running on port " + PORT);
});