import React, { useState, useEffect } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import './App.css';

function App() {
  // 1. Get saved name from localStorage
  const savedName = localStorage.getItem('technicianName') || '';

  // 2. Main State
  const [activity, setActivity] = useState({
    technicianName: savedName,
    date: new Date().toISOString().split('T')[0],
    type: 'DEVELOPMENT',
    hours: 8,
    description: '',
    reference: ''
  });

  const [allActivities, setAllActivities] = useState([]);

  // 3. Load activities from server to show in calendar
  const fetchActivities = async () => {
    try {
      const response = await fetch('[https://gestione-tecnici-ute-production.up.railway.app](https://gestione-tecnici-ute-production.up.railway.app)');
      const data = await response.json();
      setAllActivities(data);
    } catch (err) {
      console.error("Error fetching data", err);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // Aggiungi una funzione per gestire la modifica
  const handleEdit = (act) => {
    setActivity({
        ...act,
        // Carichiamo i dati dell'attività selezionata nel form
    });
    // Opzionalmente: puoi aggiungere una chiamata DELETE al server per 
    // rimuovere la vecchia versione prima di salvare quella nuova.
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    localStorage.setItem('technicianName', activity.technicianName);

    try {
        const response = await fetch('[https://gestione-tecnici-ute-production.up.railway.app](https://gestione-tecnici-ute-production.up.railway.app)', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(activity),
        });

        if (response.ok) {
            alert("Success: Activity saved!");
            setActivity({ ...activity, description: '', reference: '', hours: 8 });
            fetchActivities();
        } else {
            // Legge il messaggio di errore inviato dal server
            const errorData = await response.json();
            alert("ATTENTION: " + errorData.error);
        }
    } catch (error) {
        alert("Server connection error");
    }
};

  // 4. Map activities to Calendar Events with colors
  // PUNTO 1: Trasformo i dati in eventi per il calendario
const calendarEvents = allActivities
  .filter(act => {
    // Rendiamo il confronto più tollerante: togliamo spazi e mettiamo tutto minuscolo
    const nameA = act.technicianName.trim().toLowerCase();
    const nameB = activity.technicianName.trim().toLowerCase();
    return nameA === nameB;
  })
  .map(act => ({
    title: `${act.hours}h - ${act.type} (${act.reference})`,
    date: act.date,
    backgroundColor: act.type === 'DEVELOPMENT' ? '#3788d8' : act.type === 'LEAVE' ? '#28a745' : '#f39c12',
    borderColor: 'transparent',
    extendedProps: { ...act } // Salviamo i dati extra per future modifiche
  }));
console.log("Nome tecnico nel browser:", activity.technicianName);
console.log("Attività totali scaricate dal server:", allActivities);
  return (
    <div className="App" style={{ padding: '20px' }}>
      <h1>Technician Portal</h1>
      
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', justifyContent: 'center' }}>
        
        {/* FORM SECTION */}
        <form onSubmit={handleSubmit} style={{ textAlign: 'left', background: '#282c34', padding: '20px', borderRadius: '10px', width: '320px', color: 'white' }}>
          <h3>Log Activity</h3>
          <label>Technician Name:</label><br/>
          <input type="text" value={activity.technicianName} onChange={(e) => setActivity({...activity, technicianName: e.target.value})} style={{width: '100%', marginBottom: '10px'}} required />
          
          <label>Date:</label><br/>
          <input type="date" value={activity.date} onChange={(e) => setActivity({...activity, date: e.target.value})} style={{width: '100%', marginBottom: '10px'}} required />
          
          <label>Type:</label><br/>
          <select value={activity.type} onChange={(e) => setActivity({...activity, type: e.target.value})} style={{width: '100%', marginBottom: '10px'}}>
            <option value="DEVELOPMENT">Software Development</option>
            <option value="LEAVE">Leave / Ferie</option>
            <option value="TRIP">Business Trip / Trasferta</option>
          </select>

          <label>Hours:</label><br/>
          <input type="number" value={activity.hours} onChange={(e) => setActivity({...activity, hours: e.target.value})} style={{width: '100%', marginBottom: '10px'}} />

          <label>{activity.type === 'TRIP' ? 'Destination' : 'Project Code'}:</label><br/>
          <input type="text" value={activity.reference} onChange={(e) => setActivity({...activity, reference: e.target.value})} style={{width: '100%', marginBottom: '10px'}} />

          <label>Description:</label><br/>
          <textarea value={activity.description} onChange={(e) => setActivity({...activity, description: e.target.value})} style={{width: '100%', height: '60px', marginBottom: '10px'}} />

          <button type="submit" style={{width: '100%', padding: '10px', backgroundColor: '#61dafb', fontWeight: 'bold', cursor: 'pointer'}}>Save & Sync</button>
        </form>
        
        <div className="card">
            <h3>Your Recent Activities</h3>
            {allActivities.filter(a => a.technicianName === activity.technicianName).map(a => (
                <div key={a.id} style={{borderBottom: '1px solid #ccc', padding: '5px', display: 'flex', justifyContent: 'space-between'}}>
                    <span>{a.date}: {a.reference} ({a.hours}h)</span>
                    <button onClick={() => handleEdit(a)} style={{background: 'orange', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer'}}>Edit</button>
                </div>
            ))}
        </div>  


        {/* CALENDAR SECTION */}
        <div style={{ flex: '1', minWidth: '400px', background: 'white', padding: '15px', borderRadius: '10px', color: 'black' }}>
          <h3>Your Calendar</h3>
          <FullCalendar
            plugins={[dayGridPlugin]}
            initialView="dayGridMonth"
            events={calendarEvents}
            height="auto"
          />
        </div>

      </div>

      <div style={{ marginTop: '20px' }}>
        <button onClick={() => window.open('[https://gestione-tecnici-ute-production.up.railway.app](https://gestione-tecnici-ute-production.up.railway.app)', '_blank')} style={{padding: '10px 20px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer'}}>
          Download CSV Export
        </button>
      </div>
    </div>
  );
}

export default App;