import React, { useState, useEffect } from 'react';
import { collection, getDocs, setDoc, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { Building, Plus, LogIn, LayoutGrid, Users, UserCog, Save, ShieldAlert } from 'lucide-react';

export default function SuperAdminDashboard({ db }) {
  const { switchCompany, user } = useAuth();
  
  // Tabs: 'companies' oder 'users'
  const [activeView, setActiveView] = useState('companies');

  // Daten
  const [companies, setCompanies] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
  // UI States
  const [newCompanyName, setNewCompanyName] = useState('');
  const [showAdd, setShowAdd] = useState(false);

  // Lade Daten (Firmen UND User)
  useEffect(() => {
    const fetchData = async () => {
      if (!db) return;
      try {
        // 1. Firmen laden
        const compSnap = await getDocs(collection(db, 'companies'));
        const compList = compSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCompanies(compList);

        // 2. User laden (nur für Super Admin sichtbar dank Security Rules)
        const userSnap = await getDocs(collection(db, 'users'));
        const userList = userSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setAllUsers(userList);

      } catch (error) {
        console.error("Fehler beim Laden:", error);
      }
    };
    fetchData();
  }, [db, activeView]); // Neu laden wenn Tab wechselt

  // Firma erstellen
  const handleCreateCompany = async (e) => {
    e.preventDefault();
    if (!newCompanyName) return;
    const companyId = newCompanyName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    try {
      await setDoc(doc(db, 'companies', companyId), {
        name: newCompanyName,
        createdAt: new Date().toISOString(),
        createdBy: user.email
      });
      setCompanies([...companies, { id: companyId, name: newCompanyName }]);
      setNewCompanyName('');
      setShowAdd(false);
      alert(`Mandant "${newCompanyName}" angelegt!`);
    } catch (error) {
      alert("Fehler: " + error.message);
    }
  };

  // User einem Mandanten zuweisen
  const handleUpdateUser = async (targetUserId, newCompanyId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', targetUserId), {
        companyId: newCompanyId,
        role: newRole
      });
      // Lokalen State aktualisieren, damit man das Ergebnis sofort sieht
      setAllUsers(allUsers.map(u => u.id === targetUserId ? { ...u, companyId: newCompanyId, role: newRole } : u));
      alert("Benutzer erfolgreich zugewiesen!");
    } catch (error) {
      console.error(error);
      alert("Fehler beim Speichern: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8 font-sans text-slate-800">
      <div className="max-w-6xl mx-auto">
        
        {/* HEADER & TABS */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 flex items-center gap-3">
              <ShieldAlert className="w-8 h-8 text-blue-600"/> Kanzlei-Admin
            </h1>
            <p className="text-slate-500 mt-1">Systemverwaltung</p>
          </div>
          
          <div className="bg-white p-1 rounded-lg border shadow-sm flex">
             <button 
               onClick={() => setActiveView('companies')} 
               className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${activeView === 'companies' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               <LayoutGrid className="w-4 h-4"/> Mandanten
             </button>
             <button 
               onClick={() => setActiveView('users')} 
               className={`px-4 py-2 rounded-md text-sm font-bold flex items-center gap-2 transition ${activeView === 'users' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
             >
               <Users className="w-4 h-4"/> Benutzerverwaltung
             </button>
          </div>
        </div>

        {/* --- VIEW: MANDANTEN (COMPANIES) --- */}
        {activeView === 'companies' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-end mb-6">
                <button onClick={() => setShowAdd(!showAdd)} className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700 shadow-lg transition">
                    <Plus className="w-5 h-5" /> Neuer Mandant
                </button>
            </div>

            {showAdd && (
            <div className="bg-white p-6 rounded-xl shadow-md border mb-8">
                <h3 className="font-bold mb-4">Neuen Mandanten anlegen</h3>
                <form onSubmit={handleCreateCompany} className="flex gap-4">
                <input className="flex-1 p-3 border rounded-lg" placeholder="Firmenname" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)}/>
                <button type="submit" className="bg-green-600 text-white px-6 rounded-lg font-bold hover:bg-green-700">Anlegen</button>
                </form>
            </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map(comp => (
                <div key={comp.id} className="bg-white p-6 rounded-xl shadow-sm border hover:shadow-md transition group relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition"><Building className="w-24 h-24"/></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-start mb-4"><div className="bg-blue-50 p-3 rounded-lg"><Building className="w-6 h-6 text-blue-600" /></div><span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-1 rounded">{comp.id}</span></div>
                    <h2 className="text-xl font-bold text-slate-800 mb-2 truncate">{comp.name}</h2>
                    <p className="text-sm text-slate-500 mb-6">{allUsers.filter(u => u.companyId === comp.id).length} Benutzer zugeordnet</p>
                    <button onClick={() => switchCompany(comp.id)} className="w-full bg-slate-900 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2 group-hover:bg-blue-600 transition"><LogIn className="w-4 h-4" /> Mandant öffnen</button>
                </div>
                </div>
            ))}
            </div>
          </div>
        )}

        {/* --- VIEW: BENUTZER (USERS) --- */}
        {activeView === 'users' && (
           <div className="bg-white rounded-xl shadow-sm border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
             <div className="p-6 border-b bg-slate-50">
               <h2 className="text-lg font-bold flex items-center gap-2"><UserCog className="w-5 h-5"/> Alle registrierten Benutzer</h2>
               <p className="text-sm text-slate-500">Weisen Sie neuen Benutzern hier ihre Firma zu.</p>
             </div>
             <div className="overflow-x-auto">
               <table className="w-full text-left text-sm">
                 <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-xs">
                   <tr>
                     <th className="p-4">E-Mail / User</th>
                     <th className="p-4">Aktuelle Rolle</th>
                     <th className="p-4">Zugeordnete Firma</th>
                     <th className="p-4 text-right">Aktion</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y">
                   {allUsers.map(u => (
                     <tr key={u.id} className="hover:bg-slate-50 transition">
                       <td className="p-4">
                         <div className="font-bold text-slate-800">{u.email}</div>
                         <div className="text-xs text-slate-400 font-mono">{u.id}</div>
                       </td>
                       <td className="p-4">
                         <select 
                           className="p-2 border rounded bg-white"
                           defaultValue={u.role || 'employee'} 
                           id={`role-${u.id}`}
                         >
                           <option value="employee">Mitarbeiter</option>
                           <option value="admin">Firmen-Admin</option>
                           <option value="super_admin">Super Admin (Du)</option>
                           <option value="guest">Gast (Kein Zugriff)</option>
                         </select>
                       </td>
                       <td className="p-4">
                         <select 
                           className="p-2 border rounded bg-white w-full max-w-xs"
                           defaultValue={u.companyId || ''} 
                           id={`comp-${u.id}`}
                         >
                           <option value="">-- Keine Firma --</option>
                           {companies.map(c => (
                             <option key={c.id} value={c.id}>{c.name}</option>
                           ))}
                         </select>
                       </td>
                       <td className="p-4 text-right">
                         <button 
                           onClick={() => {
                             const newRole = document.getElementById(`role-${u.id}`).value;
                             const newComp = document.getElementById(`comp-${u.id}`).value;
                             handleUpdateUser(u.id, newComp, newRole);
                           }}
                           className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 font-bold text-xs flex items-center gap-2 ml-auto"
                         >
                           <Save className="w-3 h-3"/> Speichern
                         </button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             {allUsers.length === 0 && <div className="p-8 text-center text-slate-400">Keine Benutzer gefunden.</div>}
           </div>
        )}

      </div>
    </div>
  );
}