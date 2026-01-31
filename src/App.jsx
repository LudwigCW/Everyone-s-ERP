import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, onSnapshot, addDoc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { 
  Plus, Trash2, Save, FileText, History, User, Building, Euro, 
  Settings, Package, Globe, ChevronRight, LayoutDashboard, Download, CheckCircle, Landmark, Upload, Truck, Briefcase, LogOut, Mail, Lock, Shield, FileDown, Ban, CheckSquare, Square, Printer
} from 'lucide-react';

// ECHTE IMPORTE (Funktionieren in Produktion/Render)
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- CONFIG ---
// Vite lädt diese Variablen automatisch aus den Render Environment Variables
const firebaseConfig = {
  apiKey: "AIzaSyCWls6t8VWGmWulkN48vWElXTtFNjfIsSk",
  authDomain: "everyone-s-erp.firebaseapp.com",
  projectId: "everyone-s-erp",
  storageBucket: "everyone-s-erp.firebasestorage.app",
  messagingSenderId: "60049333234",
  appId: "1:60049333234:web:7548720abd2d38adc1296b",
  measurementId: "G-6JZ4PNKZYG"
};

// Sicherheits-Check, damit man Fehler schnell sieht
if (!firebaseConfig.apiKey) {
  console.warn("Firebase Config fehlt! Stellen Sie sicher, dass die Environment Variables in Render gesetzt sind.");
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'erp-prod-v1'; // Feste App-ID für Produktion

export default function App() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  
  // Auth State
  const [authMode, setAuthMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Database States
  const [profile, setProfile] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  const [invoices, setInvoices] = useState([]);
  
  // Selection State for Archive
  const [selectedInvoices, setSelectedInvoices] = useState([]);

  // Local Editor State
  const [currentInvoice, setCurrentInvoice] = useState(getEmptyInvoice());

  function getEmptyInvoice() {
    return {
      number: `RE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toISOString().split('T')[0],
      serviceDate: new Date().toISOString().split('T')[0],
      supplierId: 'main_profile',
      customerId: '',
      countryZone: 'DE',
      items: [{ id: Date.now(), itemId: '', description: '', quantity: 1, price: 0, taxRate: 19 }],
      notes: 'Zahlbar innerhalb von 14 Tagen ohne Abzug.',
    };
  }

  // --- Auth Logic ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setAuthError('');
    } catch (error) {
      console.error(error);
      setAuthError('Google Login fehlgeschlagen. Prüfen Sie die "Authorized Domains" in Firebase.');
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      console.error(error);
      setAuthError(error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setProfile(null);
    setCustomers([]); setItems([]); setInvoices([]);
  };

  // --- Real-time Sync ---
  useEffect(() => {
    if (!user) return;
    const syncCollection = (name, setter) => {
      const q = collection(db, 'artifacts', appId, 'users', user.uid, name);
      return onSnapshot(q, (s) => setter(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    };
    const syncProfile = () => {
       return onSnapshot(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), (doc) => {
         if (doc.exists()) setProfile({ id: doc.id, ...doc.data() }); else setProfile(null);
       });
    };
    const unsubs = [
      syncCollection('customers', setCustomers),
      syncCollection('vendors', setVendors),
      syncCollection('suppliers', setSuppliers),
      syncCollection('items', setItems),
      syncCollection('invoices', setInvoices),
      syncProfile()
    ];
    return () => unsubs.forEach(unsub => unsub());
  }, [user]);

  // --- PDF Generation Helper (Production Ready) ---
  const generatePDF = async (elementId, fileName) => {
    const input = document.getElementById(elementId);
    if (!input) {
        alert("Fehler: Vorschau nicht gefunden.");
        return;
    }
    
    // Styling für sauberen Druck anpassen (Schatten entfernen)
    const originalShadow = input.style.boxShadow;
    input.style.boxShadow = 'none';
    
    try {
        const canvas = await html2canvas(input, { scale: 2, useCORS: true });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(fileName);
    } catch (err) {
        console.error("PDF Error:", err);
        alert("Fehler beim Erstellen des PDFs.");
    } finally {
        input.style.boxShadow = originalShadow;
    }
  };

  // --- CSV Helpers ---
  const downloadCSVTemplate = (fields, filename) => {
    const headers = fields.map(f => f.label).join(';');
    const blob = new Blob([`\uFEFF${headers}\n`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_vorlage.csv`;
    link.click();
  };

  const downloadInvoicesCSV = () => {
    if (selectedInvoices.length === 0) return;
    const dataToExport = invoices.filter(inv => selectedInvoices.includes(inv.id));
    const headers = ['Rechnungsnummer', 'Datum', 'Kunde', 'Netto', 'Steuer', 'Brutto', 'Status'];
    const rows = dataToExport.map(inv => [
        inv.number,
        inv.date,
        getDisplayName(inv.customerSnap),
        inv.totals.netto.toLocaleString('de-DE').replace('.', ''),
        inv.totals.taxTotal.toLocaleString('de-DE').replace('.', ''),
        inv.totals.brutto.toLocaleString('de-DE').replace('.', ''),
        'Gebucht'
    ].join(';')); 

    const csvContent = `\uFEFF${headers.join(';')}\n${rows.join('\n')}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `rechnungsexport_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const processCSVImport = async (text, fields, collectionName) => {
    if (!user) return;
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length < 2) return; 

    const firstLine = lines[0];
    const separator = firstLine.includes(';') ? ';' : ',';
    const headers = firstLine.split(separator).map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
    
    const fieldMap = {};
    headers.forEach((header, index) => {
      const foundField = fields.find(f => f.label.toLowerCase() === header || f.key.toLowerCase() === header);
      if (foundField) fieldMap[index] = foundField.key;
    });

    const batch = writeBatch(db);
    let count = 0;
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(separator).map(v => v.trim().replace(/^"|"$/g, ''));
      if (values.length < headers.length) continue; 
      const newDoc = {};
      Object.keys(fieldMap).forEach(index => {
         let val = values[index];
         if (fieldMap[index] === 'price' || fieldMap[index] === 'quantity') val = val.replace(',', '.');
         newDoc[fieldMap[index]] = val;
      });
      if (Object.keys(newDoc).length > 0) {
        const ref = doc(collection(db, 'artifacts', appId, 'users', user.uid, collectionName));
        batch.set(ref, newDoc);
        count++;
      }
    }
    if (count > 0) { await batch.commit(); alert(`${count} Datensätze erfolgreich importiert!`); } 
    else { alert("Keine passenden Datensätze gefunden."); }
  };

  // --- Logic Helpers ---
  const handleSaveData = async (col, data) => {
    if (!user) return;
    try {
      if (data.id) await updateDoc(doc(db, 'artifacts', appId, 'users', user.uid, col, data.id), data);
      else await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, col), data);
    } catch (e) { console.error(e); }
  };

  const handleSaveProfile = async (data) => {
    if (!user) return;
    try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'settings', 'profile'), data, { merge: true }); alert("Profil gespeichert!"); } catch (e) { console.error(e); }
  };

  const handleDelete = async (col, id) => {
    if (!user) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, col, id));
  };

  // --- Storno Logic ---
  const handleStorno = async (originalInvoice) => {
      if(!window.confirm(`Möchten Sie die Rechnung ${originalInvoice.number} wirklich stornieren? Es wird eine Gutschrift erstellt.`)) return;
      
      const stornoInvoice = {
          ...originalInvoice,
          number: `STORNO-${originalInvoice.number}`,
          date: new Date().toISOString().split('T')[0],
          notes: `Storno zu Rechnung ${originalInvoice.number}.`,
          items: originalInvoice.items.map(item => ({
              ...item,
              price: -Math.abs(item.price)
          })),
          createdAt: new Date().toISOString(),
          relatedInvoiceId: originalInvoice.id
      };

      let netto = 0;
      let taxGroups = {};
      stornoInvoice.items.forEach(item => {
        const lineNetto = item.quantity * item.price;
        netto += lineNetto;
        const rate = stornoInvoice.countryZone === 'DE' ? item.taxRate : 0;
        taxGroups[rate] = (taxGroups[rate] || 0) + (lineNetto * (rate / 100));
      });
      const taxTotal = Object.values(taxGroups).reduce((a, b) => a + b, 0);
      stornoInvoice.totals = { netto, taxGroups, taxTotal, brutto: netto + taxTotal };

      delete stornoInvoice.id; 

      try {
          await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'invoices'), stornoInvoice);
          alert("Stornorechnung erfolgreich erstellt!");
      } catch(e) {
          console.error(e);
          alert("Fehler beim Stornieren.");
      }
  };

  const getDisplayName = (r) => {
    if (!r) return '';
    if (r.description) return r.description;
    return r.company ? r.company : `${r.firstName || ''} ${r.lastName || ''}`.trim();
  };

  const getSenderData = () => {
    if (currentInvoice.supplierId === 'main_profile') return profile || {};
    return suppliers.find(s => s.id === currentInvoice.supplierId) || {};
  };

  const getFullAddress = (r) => {
    if (!r) return [];
    const lines = [];
    if (r.company) lines.push(r.company);
    if (r.firstName || r.lastName) lines.push(`${r.salutation || ''} ${r.firstName || ''} ${r.lastName || ''}`.trim());
    if (r.addressSupplement) lines.push(r.addressSupplement);
    lines.push(`${r.street || ''} ${r.houseNumber || ''}`.trim());
    lines.push(`${r.zip || ''} ${r.city || ''}`.trim());
    if (r.country) lines.push(r.country);
    return lines.filter(l => l && l.trim() !== '');
  };

  const totals = useMemo(() => {
    let netto = 0;
    let taxGroups = {};
    currentInvoice.items.forEach(item => {
      const lineNetto = item.quantity * item.price;
      netto += lineNetto;
      const rate = currentInvoice.countryZone === 'DE' ? item.taxRate : 0;
      taxGroups[rate] = (taxGroups[rate] || 0) + (lineNetto * (rate / 100));
    });
    const taxTotal = Object.values(taxGroups).reduce((a, b) => a + b, 0);
    return { netto, taxGroups, taxTotal, brutto: netto + taxTotal };
  }, [currentInvoice]);

  const saveInvoice = async () => {
    if (!user || !currentInvoice.customerId) { alert("Bitte Kunde auswählen!"); return; }
    setLoading(true);
    const fullInvoice = {
      ...currentInvoice,
      totals,
      customerSnap: customers.find(c => c.id === currentInvoice.customerId),
      supplierSnap: getSenderData(),
      createdAt: new Date().toISOString()
    };
    await handleSaveData('invoices', fullInvoice);
    setLoading(false);
    setCurrentInvoice(getEmptyInvoice());
    setActiveTab('history');
  };

  const addressFields = [
    { key: 'number', label: 'Nr.', placeholder: '1001', halfWidth: true, required: true },
    { key: 'company', label: 'Firmenname', fullWidth: true, required: true },
    { key: 'salutation', label: 'Anrede', placeholder: 'Herr/Frau' },
    { key: 'firstName', label: 'Vorname' },
    { key: 'lastName', label: 'Nachname', halfWidth: true },
    { key: 'street', label: 'Straße', halfWidth: true, required: true },
    { key: 'houseNumber', label: 'Hausnr.', required: true },
    { key: 'addressSupplement', label: 'Zusatz (z.B. Hinterhof)' },
    { key: 'zip', label: 'PLZ', required: true },
    { key: 'city', label: 'Ort', halfWidth: true, required: true },
    { key: 'country', label: 'Land', placeholder: 'Deutschland', required: true },
    { key: 'taxId', label: 'USt-IdNr.', halfWidth: true, required: true },
    { key: 'email', label: 'E-Mail', halfWidth: true },
    { key: 'phone', label: 'Telefon', halfWidth: true },
  ];

  const itemFields = [
    { key: 'number', label: 'Artikelnummer', placeholder: 'ART-001', halfWidth: true, required: true },
    { key: 'ean', label: 'EAN / GTIN', placeholder: 'Optional', halfWidth: true },
    { key: 'description', label: 'Artikelbezeichnung', fullWidth: true, required: true },
    { key: 'price', label: 'Standardpreis (Netto)', placeholder: '0.00', halfWidth: true, required: true },
    { key: 'unit', label: 'Einheit', placeholder: 'Stk, Std, m', halfWidth: true, required: true },
  ];

  // --- Component: ModuleManager ---
  const ModuleManager = ({ title, data, fields, collectionName, icon: Icon }) => {
    const [editItem, setEditItem] = useState(null);
    const fileInputRef = useRef(null);
    
    const handleFileChange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      await processCSVImport(text, fields, collectionName);
      e.target.value = null;
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Icon className="w-6 h-6 text-blue-600"/> {title}</h2>
          <div className="flex gap-2">
            <button onClick={() => downloadCSVTemplate(fields, collectionName)} className="text-slate-500 hover:text-blue-600 px-3 py-2 text-sm flex items-center gap-2 underline">
               <FileDown className="w-4 h-4"/> Vorlage laden
            </button>
            <input type="file" ref={fileInputRef} hidden accept=".csv" onChange={handleFileChange} />
            <button onClick={() => fileInputRef.current.click()} className="bg-white border text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm flex items-center gap-2 text-sm font-medium">
              <Upload className="w-4 h-4"/> CSV Import
            </button>
            <button onClick={() => setEditItem({})} className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-medium">
              <Plus className="w-4 h-4"/> Neu
            </button>
          </div>
        </div>
        
        {editItem && (
          <div className="mb-8 p-6 bg-slate-50 rounded-lg border shadow-inner animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {fields.map(f => (
                <div key={f.key} className={f.fullWidth ? "md:col-span-2 lg:col-span-4" : f.halfWidth ? "md:col-span-1 lg:col-span-2" : "col-span-1"}>
                   <label className="block text-xs font-semibold text-slate-500 mb-1">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
                   <input placeholder={f.placeholder || f.label} className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none bg-white shadow-sm" value={editItem[f.key] || ''} onChange={e => setEditItem({...editItem, [f.key]: e.target.value})}/>
                </div>
              ))}
            </div>
            <div className="mt-6 flex gap-2">
              <button onClick={() => { handleSaveData(collectionName, editItem); setEditItem(null); }} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 font-medium transition shadow-md">Speichern</button>
              <button onClick={() => setEditItem(null)} className="bg-slate-300 text-slate-700 px-6 py-2 rounded-lg hover:bg-slate-400 font-medium transition">Abbrechen</button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          {data.map(item => (
            <div key={item.id} className="flex justify-between items-center p-4 border rounded-lg hover:bg-slate-50 group transition">
              <div className="flex gap-4 items-center">
                 <div className="bg-blue-100 text-blue-700 font-bold p-2 rounded text-xs w-16 text-center shrink-0 truncate">{item.number || '---'}</div>
                 <div>
                    <p className="font-bold text-slate-800">{getDisplayName(item)}</p>
                    {collectionName === 'items' ? (
                       <p className="text-xs text-slate-500 font-medium">{item.price ? parseFloat(item.price).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '0,00 €'} {' / '}{item.unit || 'Stk'} {item.ean && <span className="ml-2 text-slate-400 font-normal">EAN: {item.ean}</span>}</p>
                    ) : (
                       <p className="text-xs text-slate-500">{[item.zip, item.city].filter(Boolean).join(' ')} • {item.email || 'Keine E-Mail'}</p>
                    )}
                 </div>
              </div>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                <button onClick={() => setEditItem(item)} className="p-2 text-blue-600 hover:bg-blue-100 rounded"><Settings className="w-4 h-4"/></button>
                <button onClick={() => handleDelete(collectionName, item.id)} className="p-2 text-red-600 hover:bg-red-100 rounded"><Trash2 className="w-4 h-4"/></button>
              </div>
            </div>
          ))}
          {data.length === 0 && <p className="text-center text-slate-400 py-8 italic">Keine Einträge. CSV Import oder "Neu" nutzen.</p>}
        </div>
      </div>
    );
  };

  // --- RENDER: Login OR App ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl">
          <div className="text-center mb-8"><div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8 text-blue-600" /></div><h1 className="text-2xl font-bold text-slate-800">ERP FLOW Login</h1><p className="text-slate-500">Ihr professionelles Rechnungstool</p></div>
          {authError && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center gap-2"><Shield className="w-4 h-4"/> {authError}</div>}
          <div className="space-y-4">
            <button onClick={handleGoogleLogin} className="w-full bg-white border border-slate-300 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-50 transition flex items-center justify-center gap-2"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" /> Mit Google anmelden</button>
            <div className="relative my-6"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div><div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-slate-500">oder mit E-Mail</span></div></div>
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">E-Mail Adresse</label><div className="relative"><Mail className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" /><input type="email" required className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="name@firma.de" value={email} onChange={e => setEmail(e.target.value)} /></div></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Passwort</label><div className="relative"><Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" /><input type="password" required className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} /></div></div>
              <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg">{authMode === 'login' ? 'Einloggen' : 'Konto erstellen'}</button>
            </form>
            <p className="text-center text-sm text-slate-500 mt-4">{authMode === 'login' ? 'Noch kein Konto?' : 'Bereits registriert?'} <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-blue-600 font-bold ml-1 hover:underline">{authMode === 'login' ? 'Jetzt registrieren' : 'Hier anmelden'}</button></p>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: Main App ---
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-800">
      <nav className="w-full md:w-64 bg-slate-900 text-slate-300 p-6 flex flex-col gap-2 shrink-0">
        <div className="mb-8"><h1 className="text-white text-2xl font-black flex items-center gap-2"><FileText className="text-blue-500" /> ERP FLOW</h1><p className="text-[10px] uppercase tracking-widest opacity-50">Multi-User Billing System</p></div>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, { id: 'editor', label: 'Neue Rechnung', icon: Plus }, { id: 'history', label: 'Rechnungsarchiv', icon: History },
          { id: 'customers', label: 'Kunden', icon: User }, { id: 'vendors', label: 'Lieferanten', icon: Truck }, { id: 'items', label: 'Artikel', icon: Package },
          { id: 'suppliers', label: 'Andere Absender', icon: Briefcase }, { id: 'settings', label: 'Einstellungen', icon: Settings },
        ].map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} className={`flex items-center gap-3 p-3 rounded-lg transition ${activeTab === item.id ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-slate-800'}`}>
            <item.icon className="w-5 h-5" /> {item.label}
          </button>
        ))}
        <div className="mt-auto pt-6 border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-400 hover:text-white transition text-sm w-full p-2 rounded hover:bg-slate-800"><LogOut className="w-4 h-4" /> Abmelden</button>
          <div className="text-[10px] text-slate-600 mt-4 truncate">ID: {user?.uid}</div>
        </div>
      </nav>

      <main className="flex-1 p-4 md:p-10 overflow-y-auto h-screen scroll-smooth">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-blue-500"><p className="text-slate-500 text-sm font-medium">Umsatz Gesamt</p><h3 className="text-3xl font-bold mt-1 text-slate-800">{invoices.reduce((acc, curr) => acc + curr.totals.brutto, 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</h3></div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-green-500"><p className="text-slate-500 text-sm font-medium">Rechnungen</p><h3 className="text-3xl font-bold mt-1 text-slate-800">{invoices.length}</h3></div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-purple-500"><p className="text-slate-500 text-sm font-medium">Kunden</p><h3 className="text-3xl font-bold mt-1 text-slate-800">{customers.length}</h3></div>
            </div>
            {!profile && <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl flex justify-between items-center"><div><h3 className="font-bold text-yellow-800 mb-1">Profil unvollständig</h3><p className="text-sm text-yellow-700">Bitte richten Sie Ihr Firmenprofil ein.</p></div><button onClick={() => setActiveTab('settings')} className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">Einstellungen</button></div>}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border p-8 animate-in slide-in-from-bottom-4 duration-500">
             <div className="border-b pb-4 mb-8"><h2 className="text-2xl font-bold flex items-center gap-2"><Settings className="w-6 h-6 text-blue-600"/> Mein Firmenprofil</h2><p className="text-slate-500 mt-1">Diese Daten erscheinen als Absender und im Fußbereich Ihrer Rechnungen.</p></div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-4"><h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 border-b pb-2">Allgemeine Daten</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Firmenname <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded" placeholder="Muster GmbH" value={profile?.company || ''} onChange={e => setProfile({...profile, company: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Straße <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded" placeholder="Hauptstr." value={profile?.street || ''} onChange={e => setProfile({...profile, street: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Hausnummer <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded" placeholder="10 a" value={profile?.houseNumber || ''} onChange={e => setProfile({...profile, houseNumber: e.target.value})} /></div>
                    <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Adresszusatz</label><input className="w-full p-2 border rounded" placeholder="Hinterhaus" value={profile?.addressSupplement || ''} onChange={e => setProfile({...profile, addressSupplement: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">PLZ <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded" placeholder="10115" value={profile?.zip || ''} onChange={e => setProfile({...profile, zip: e.target.value})} /></div>
                    <div><label className="block text-xs font-bold text-slate-500 mb-1">Ort <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded" placeholder="Berlin" value={profile?.city || ''} onChange={e => setProfile({...profile, city: e.target.value})} /></div>
                    <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">Land <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded" placeholder="Deutschland" value={profile?.country || ''} onChange={e => setProfile({...profile, country: e.target.value})} /></div>
                  </div>
                </div>
                <div className="space-y-4"><h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 border-b pb-2">Kontakt & Steuer</h3><div><label className="block text-xs font-bold text-slate-500 mb-1">USt-IdNr. <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded" placeholder="DE123456789" value={profile?.taxId || ''} onChange={e => setProfile({...profile, taxId: e.target.value})} /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">E-Mail</label><input className="w-full p-2 border rounded" placeholder="info@firma.de" value={profile?.email || ''} onChange={e => setProfile({...profile, email: e.target.value})} /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Telefon</label><input className="w-full p-2 border rounded" placeholder="+49 30 123456" value={profile?.phone || ''} onChange={e => setProfile({...profile, phone: e.target.value})} /></div></div>
                <div className="space-y-4"><h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 border-b pb-2">Geschäftsführung</h3><div><label className="block text-xs font-bold text-slate-500 mb-1">Vorname <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded" placeholder="Max" value={profile?.ceoFirstName || ''} onChange={e => setProfile({...profile, ceoFirstName: e.target.value})} /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Nachname <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded" placeholder="Mustermann" value={profile?.ceoLastName || ''} onChange={e => setProfile({...profile, ceoLastName: e.target.value})} /></div></div>
                <div className="md:col-span-2 space-y-4 mt-4"><h3 className="font-bold text-sm uppercase tracking-wider text-slate-400 border-b pb-2 flex items-center gap-2"><Landmark className="w-4 h-4"/> Bank & Registergericht</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="block text-xs font-bold text-slate-500 mb-1">Bankname <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded" placeholder="Volksbank Berlin" value={profile?.bankName || ''} onChange={e => setProfile({...profile, bankName: e.target.value})} /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">IBAN <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded font-mono" placeholder="DE00 0000 0000 0000 0000 00" value={profile?.iban || ''} onChange={e => setProfile({...profile, iban: e.target.value})} /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">BIC <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded font-mono" placeholder="GENODED1BER" value={profile?.bic || ''} onChange={e => setProfile({...profile, bic: e.target.value})} /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Registergericht <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded" placeholder="Berlin-Charlottenburg" value={profile?.registerCourt || ''} onChange={e => setProfile({...profile, registerCourt: e.target.value})} /></div><div><label className="block text-xs font-bold text-slate-500 mb-1">Handelsregisternummer <span className="text-red-500">*</span></label><input className="w-full p-2 border rounded" placeholder="HRB 12345" value={profile?.registerNumber || ''} onChange={e => setProfile({...profile, registerNumber: e.target.value})} /></div></div></div>
             </div>
             <div className="mt-8 pt-6 border-t flex justify-end"><button onClick={() => handleSaveProfile(profile)} className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-green-700 flex items-center gap-2"><Save className="w-5 h-5"/> Einstellungen speichern</button></div>
          </div>
        )}

        {activeTab === 'customers' && <ModuleManager title="Kundenmanagement" data={customers} collectionName="customers" icon={User} fields={addressFields} />}
        {activeTab === 'vendors' && <ModuleManager title="Lieferantenmanagement (Externe)" data={vendors} collectionName="vendors" icon={Truck} fields={addressFields} />}
        {activeTab === 'suppliers' && <ModuleManager title="Andere Absender / Profile" data={suppliers} collectionName="suppliers" icon={Building} fields={addressFields} />}
        {activeTab === 'items' && <ModuleManager title="Artikelkatalog" data={items} collectionName="items" icon={Package} fields={itemFields} />}

        {/* --- INVOICE EDITOR --- */}
        {activeTab === 'editor' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-20">
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                <h2 className="text-lg font-bold border-b pb-2 flex items-center gap-2"><Globe className="w-5 h-5 text-blue-500"/> Stammdaten-Auswahl</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-400">Absender</label><select className="w-full p-2 border rounded bg-white font-medium text-slate-700" value={currentInvoice.supplierId} onChange={e => setCurrentInvoice({...currentInvoice, supplierId: e.target.value})}><option value="main_profile">Mein Hauptprofil (Standard)</option>{suppliers.map(s => <option key={s.id} value={s.id}>{getDisplayName(s)}</option>)}</select></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-400">Kunde (Empfänger)</label><select className="w-full p-2 border rounded bg-white" value={currentInvoice.customerId} onChange={e => setCurrentInvoice({...currentInvoice, customerId: e.target.value})}><option value="">-- Kunde wählen --</option>{customers.map(c => <option key={c.id} value={c.id}>{getDisplayName(c)}</option>)}</select></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-400">Steuerland / Zone</label><select className="w-full p-2 border rounded bg-white" value={currentInvoice.countryZone} onChange={e => setCurrentInvoice({...currentInvoice, countryZone: e.target.value})}><option value="DE">Deutschland (Normal)</option><option value="EU">EU (Reverse Charge 0%)</option><option value="Drittland">Drittland (Export 0%)</option></select></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-400">Rechnungs-Nr.</label><input className="w-full p-2 border rounded" value={currentInvoice.number} onChange={e => setCurrentInvoice({...currentInvoice, number: e.target.value})}/></div>
                  <div className="space-y-1"><label className="text-xs font-bold text-slate-400">Rechnungsdatum</label><input type="date" className="w-full p-2 border rounded" value={currentInvoice.date} onChange={e => setCurrentInvoice({...currentInvoice, date: e.target.value})}/></div>
                   <div className="space-y-1"><label className="text-xs font-bold text-slate-400">Leistungsdatum</label><input type="date" className="w-full p-2 border rounded" value={currentInvoice.serviceDate} onChange={e => setCurrentInvoice({...currentInvoice, serviceDate: e.target.value})}/></div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border">
                <h2 className="text-lg font-bold border-b pb-2 mb-4">Rechnungsposten</h2>
                {currentInvoice.items.map((line, idx) => (
                  <div key={line.id} className="grid grid-cols-12 gap-2 mb-4 items-end border-b pb-4 last:border-0">
                    <div className="col-span-12 md:col-span-5 space-y-1">
                      <label className="text-[10px] text-slate-400">Artikel</label>
                      <select className="w-full p-2 border rounded bg-slate-50 text-xs mb-1" onChange={e => { const item = items.find(i => i.id === e.target.value); if(item) { const newItems = [...currentInvoice.items]; newItems[idx] = { ...line, description: item.description, price: parseFloat(item.price) || 0 }; setCurrentInvoice({...currentInvoice, items: newItems}); } }}><option value="">-- Katalog --</option>{items.map(i => <option key={i.id} value={i.id}>{i.number ? i.number + ' - ' : ''}{i.description}</option>)}</select>
                      <input className="w-full p-2 border rounded" value={line.description} onChange={e => { const newItems = [...currentInvoice.items]; newItems[idx].description = e.target.value; setCurrentInvoice({...currentInvoice, items: newItems}); }} />
                    </div>
                    <div className="col-span-3 md:col-span-2"><input type="number" className="w-full p-2 border rounded" value={line.quantity} onChange={e => { const newItems = [...currentInvoice.items]; newItems[idx].quantity = parseFloat(e.target.value) || 0; setCurrentInvoice({...currentInvoice, items: newItems}); }}/></div>
                    <div className="col-span-4 md:col-span-2"><input type="number" className="w-full p-2 border rounded" value={line.price} onChange={e => { const newItems = [...currentInvoice.items]; newItems[idx].price = parseFloat(e.target.value) || 0; setCurrentInvoice({...currentInvoice, items: newItems}); }}/></div>
                    <div className="col-span-4 md:col-span-2"><select className="w-full p-2 border rounded" value={line.taxRate} onChange={e => { const newItems = [...currentInvoice.items]; newItems[idx].taxRate = parseInt(e.target.value); setCurrentInvoice({...currentInvoice, items: newItems}); }}><option value="19">19%</option><option value="7">7%</option><option value="0">0%</option></select></div>
                    <div className="col-span-1"><button onClick={() => setCurrentInvoice({...currentInvoice, items: currentInvoice.items.filter(i => i.id !== line.id)})} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4"/></button></div>
                  </div>
                ))}
                <button onClick={() => setCurrentInvoice({...currentInvoice, items: [...currentInvoice.items, { id: Date.now(), description: '', quantity: 1, price: 0, taxRate: 19 }]})} className="w-full py-2 border-2 border-dashed rounded-lg text-slate-400 hover:text-blue-600 hover:border-blue-400 transition">+ Weiteren Posten hinzufügen</button>
              </div>
              
              <div className="bg-white p-6 rounded-xl shadow-sm border space-y-2"><label className="text-xs font-bold text-slate-400">Fußtext / Anmerkungen</label><textarea className="w-full p-2 border rounded" rows="3" value={currentInvoice.notes} onChange={e => setCurrentInvoice({...currentInvoice, notes: e.target.value})}/></div>
              <div className="flex gap-4">
                <button onClick={saveInvoice} disabled={loading} className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-blue-700 transition"><Save className="w-5 h-5"/> {loading ? 'Wird gebucht...' : 'Buchen & Archivieren'}</button>
                <button onClick={() => generatePDF('invoice-preview', `Rechnung_${currentInvoice.number}.pdf`)} className="bg-red-600 text-white px-6 py-4 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-red-700 transition"><Printer className="w-5 h-5"/> Drucken / PDF</button>
              </div>
            </div>

            {/* Live Preview */}
            <div id="invoice-preview" className="bg-white shadow-2xl rounded-sm p-12 text-[11px] leading-tight min-h-[900px] border relative">
              <div className="flex justify-between mb-12">
                <div className="text-slate-400 uppercase text-[9px]">{(() => { const s = getSenderData(); if(!s.company && !s.firstName) return 'BITTE PROFIL EINSTELLEN'; return `${getDisplayName(s)} · ${s.street || ''} ${s.houseNumber || ''} · ${s.zip || ''} ${s.city || ''}`; })()}</div>
                <div className="text-right">
                  <h2 className="text-2xl font-black text-slate-800 tracking-tighter">RECHNUNG</h2>
                  <p className="text-slate-500 font-bold mb-4">{currentInvoice.number}</p>
                  <div className="text-[9px] text-slate-500">{(() => { const s = getSenderData(); return (<>{s.phone && <p>Tel: {s.phone}</p>}{s.email && <p>Email: {s.email}</p>}</>) })()}</div>
                </div>
              </div>
              <div className="mb-12 h-32">{(() => { const c = customers.find(c => c.id === currentInvoice.customerId); if(!c) return <p className="text-slate-300 italic">Bitte Kunde wählen...</p>; return (<div className="text-sm">{getFullAddress(c).map((line, i) => (<p key={i} className={i === 0 ? "font-bold" : ""}>{line}</p>))}</div>); })()}</div>
              <div className="flex justify-between mb-8 border-b pb-4"><div><p className="font-bold text-[10px] text-slate-500 uppercase">Leistungsdatum</p><p>{new Date(currentInvoice.serviceDate).toLocaleDateString('de-DE')}</p></div><div className="text-right"><p className="font-bold text-[10px] text-slate-500 uppercase">Rechnungsdatum</p><p>{new Date(currentInvoice.date).toLocaleDateString('de-DE')}</p></div></div>
              <table className="w-full mb-8"><thead className="border-b-2 border-slate-900"><tr className="text-left font-bold"><th className="py-2">Pos</th><th className="py-2">Beschreibung</th><th className="py-2 text-right">Anz.</th><th className="py-2 text-right">Einzel</th><th className="py-2 text-right">Gesamt</th></tr></thead><tbody className="divide-y divide-slate-100">{currentInvoice.items.map((line, idx) => (<tr key={line.id}><td className="py-3 text-slate-400">{idx+1}</td><td className="py-3 font-semibold">{line.description || 'Leistung'}</td><td className="py-3 text-right">{line.quantity}</td><td className="py-3 text-right">{line.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td><td className="py-3 text-right font-bold">{(line.quantity * line.price).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td></tr>))}</tbody></table>
              <div className="flex justify-end mb-12"><div className="w-56 space-y-1"><div className="flex justify-between"><span>Summe Netto:</span><span>{totals.netto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span></div>{Object.entries(totals.taxGroups).map(([rate, val]) => (<div key={rate} className="flex justify-between text-slate-500 italic"><span>MwSt {rate}%:</span><span>{val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span></div>))}<div className="flex justify-between font-black text-sm border-t-2 border-slate-900 pt-2 mt-2"><span>GESAMTBETRAG:</span><span>{totals.brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span></div></div></div>
              <div className="absolute bottom-8 left-12 right-12 border-t pt-4 grid grid-cols-3 gap-4 text-[8px] text-slate-500">
                <div>{(() => { const s = getSenderData(); if(!s.company && !s.firstName) return <span className="text-red-300">Profil fehlt</span>; return (<><p className="font-bold mb-1 text-slate-800">{getDisplayName(s)}</p><p>{s.street} {s.houseNumber}</p><p>{s.addressSupplement}</p><p>{s.zip} {s.city}</p><p>{s.country}</p><p className="mt-2 text-[9px]">USt-IdNr.: {s.taxId || '-'}</p></>) })()}</div>
                <div><p className="font-bold mb-1 text-slate-800">Bankverbindung</p>{(() => { const s = getSenderData(); return (<><p>{s.bankName || '-'}</p><p>IBAN: {s.iban || '-'}</p><p>BIC: {s.bic || '-'}</p></>) })()}</div>
                <div><p className="font-bold mb-1 text-slate-800">Registergericht</p>{(() => { const s = getSenderData(); return (<><p>Amtsgericht {s.registerCourt || '-'}</p><p>HR-Nr: {s.registerNumber || '-'}</p><p className="mt-1 font-bold">Geschäftsführung:</p><p>{s.ceoFirstName} {s.ceoLastName}</p></>) })()}</div>
              </div>
            </div>
          </div>
        )}

        {/* --- HISTORY TAB --- */}
        {activeTab === 'history' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
             <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                <div><h2 className="text-xl font-bold">Rechnungsarchiv</h2><div className="text-xs text-slate-500">Gefiltert auf Ihre Benutzer-ID</div></div>
                {/* Bulk Actions */}
                {selectedInvoices.length > 0 && (
                    <div className="flex gap-2 items-center bg-blue-50 p-2 rounded-lg border border-blue-100 animate-in fade-in">
                        <span className="text-sm font-bold text-blue-800 px-2">{selectedInvoices.length} ausgewählt</span>
                        <button onClick={downloadInvoicesCSV} className="text-blue-700 hover:bg-blue-100 px-3 py-1 rounded text-xs flex items-center gap-1"><FileText className="w-3 h-3"/> CSV Export</button>
                    </div>
                )}
             </div>
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold">
                    <tr>
                        <th className="p-4 w-10">
                            <button onClick={() => setSelectedInvoices(selectedInvoices.length === invoices.length ? [] : invoices.map(i => i.id))}>
                                {selectedInvoices.length === invoices.length && invoices.length > 0 ? <CheckSquare className="w-4 h-4 text-blue-600"/> : <Square className="w-4 h-4"/>}
                            </button>
                        </th>
                        <th className="p-4">Nummer</th><th className="p-4">Kunde</th><th className="p-4">Netto</th><th className="p-4">Brutto</th><th className="p-4 text-right">Aktion</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {invoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50">
                            <td className="p-4">
                                <button onClick={() => setSelectedInvoices(prev => prev.includes(inv.id) ? prev.filter(id => id !== inv.id) : [...prev, inv.id])}>
                                    {selectedInvoices.includes(inv.id) ? <CheckSquare className="w-4 h-4 text-blue-600"/> : <Square className="w-4 h-4 text-slate-300"/>}
                                </button>
                            </td>
                            <td className="p-4 font-bold">{inv.number}</td>
                            <td className="p-4"><p className="font-medium">{getDisplayName(inv.customerSnap)}</p><p className="text-[10px] text-slate-400">{inv.date}</p></td>
                            <td className="p-4 text-slate-500">{inv.totals.netto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                            <td className={`p-4 font-bold ${inv.totals.brutto < 0 ? 'text-red-600' : 'text-blue-600'}`}>{inv.totals.brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                            <td className="p-4 text-right flex justify-end gap-2">
                                <button onClick={() => handleStorno(inv)} title="Stornieren / Gutschrift" className="text-orange-400 hover:text-orange-600 bg-orange-50 hover:bg-orange-100 p-2 rounded"><Ban className="w-4 h-4"/></button>
                                <button onClick={() => handleDelete('invoices', inv.id)} className="text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded"><Trash2 className="w-4 h-4"/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
          </div>
        )}
      </main>
    </div>
  );
}