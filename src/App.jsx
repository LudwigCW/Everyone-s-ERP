import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import SuperAdminDashboard from './SuperAdminDashboard';
import { ArrowLeft } from 'lucide-react';
import { AuthProvider, useAuth } from './AuthContext';
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
  Settings, Package, Globe, ChevronRight, LayoutDashboard, Download, CheckCircle, Landmark, Upload, Truck, Briefcase, LogOut, Mail, Lock, Shield, FileDown, Ban, CheckSquare, Square, Printer, Eye, ArrowUpRight, ArrowDownLeft, X
} from 'lucide-react';

// --- WICHTIG: BITTE LOKAL DIE FOLGENDEN ZWEI ZEILEN AKTIVIEREN (// LÖSCHEN) ---
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  // ... deine anderen Icons ...
  Hash 
} from 'lucide-react';

// --- KONSTANTE: EU STEUERSÄTZE (STAND 2025/2026) ---
const DEFAULT_EU_RATES = [
  { country: 'Belgien', code: 'BE', standard: 21, reduced1: 12, reduced2: 6 },
  { country: 'Bulgarien', code: 'BG', standard: 20, reduced1: 9, reduced2: 0 },
  { country: 'Dänemark', code: 'DK', standard: 25, reduced1: 0, reduced2: 0 },
  { country: 'Deutschland', code: 'DE', standard: 19, reduced1: 7, reduced2: 0 },
  { country: 'Estland', code: 'EE', standard: 22, reduced1: 13, reduced2: 9 },
  { country: 'Finnland', code: 'FI', standard: 25.5, reduced1: 14, reduced2: 10 },
  { country: 'Frankreich', code: 'FR', standard: 20, reduced1: 10, reduced2: 5.5 },
  { country: 'Griechenland', code: 'GR', standard: 24, reduced1: 13, reduced2: 6 },
  { country: 'Irland', code: 'IE', standard: 23, reduced1: 13.5, reduced2: 9 },
  { country: 'Italien', code: 'IT', standard: 22, reduced1: 10, reduced2: 5 },
  { country: 'Kroatien', code: 'HR', standard: 25, reduced1: 13, reduced2: 5 },
  { country: 'Lettland', code: 'LV', standard: 21, reduced1: 12, reduced2: 5 },
  { country: 'Litauen', code: 'LT', standard: 21, reduced1: 9, reduced2: 5 },
  { country: 'Luxemburg', code: 'LU', standard: 17, reduced1: 14, reduced2: 8 },
  { country: 'Malta', code: 'MT', standard: 18, reduced1: 7, reduced2: 5 },
  { country: 'Niederlande', code: 'NL', standard: 21, reduced1: 9, reduced2: 0 },
  { country: 'Österreich', code: 'AT', standard: 20, reduced1: 13, reduced2: 10 },
  { country: 'Polen', code: 'PL', standard: 23, reduced1: 8, reduced2: 5 },
  { country: 'Portugal', code: 'PT', standard: 23, reduced1: 13, reduced2: 6 },
  { country: 'Rumänien', code: 'RO', standard: 19, reduced1: 9, reduced2: 5 },
  { country: 'Schweden', code: 'SE', standard: 25, reduced1: 12, reduced2: 6 },
  { country: 'Slowakei', code: 'SK', standard: 23, reduced1: 19, reduced2: 5 },
  { country: 'Slowenien', code: 'SI', standard: 22, reduced1: 9.5, reduced2: 5 },
  { country: 'Spanien', code: 'ES', standard: 21, reduced1: 10, reduced2: 4 },
  { country: 'Tschechien', code: 'CZ', standard: 21, reduced1: 12, reduced2: 0 },
  { country: 'Ungarn', code: 'HU', standard: 27, reduced1: 18, reduced2: 5 },
  { country: 'Zypern', code: 'CY', standard: 19, reduced1: 9, reduced2: 5 },
];

// --- CONFIG ---
const getFirebaseConfig = () => {
  // Wir lesen die Werte aus der .env Datei
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
  };
};

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'erp-prod-v2';

function ErpSystem() {
  // 1. HIER 'switchCompany' HINZUFÜGEN (im Screenshot fehlt das noch)
  const { user, userProfile, activeCompanyId, switchCompany, loading: authLoading } = useAuth();

  // ... deine States (activeTab, loading etc.) können hier bleiben ...

  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  // --- DIESEN BLOCK WIEDER EINFÜGEN ---
  // Auth State (Wir brauchen das doch noch kurz, solange das Login hier drin ist)
  const [authMode, setAuthMode] = useState('login'); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  // ------------------------------------

  // Database States
  const [profile, setProfile] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [items, setItems] = useState([]);
  
  // Transaction States
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // UI States
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [viewInvoice, setViewInvoice] = useState(null); 

  // --- STATE FÜR SORTIERUNG & FILTER IM ARCHIV ---
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' }); // Standard: Neueste zuerst
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterDateStart, setFilterDateStart] = useState(''); // Startdatum
  const [filterDateEnd, setFilterDateEnd] = useState('');     // Enddatum
  const [searchTerm, setSearchTerm] = useState('');

  // --- ZUSTAND FÜR VORSCHAU-SKALIERUNG ---
  const [previewScale, setPreviewScale] = useState(1);
  const previewContainerRef = useRef(null);

  // Diese Funktion berechnet die perfekte Größe
  useEffect(() => {
    const calculateScale = () => {
        if (previewContainerRef.current) {
            // Breite des grauen Kastens messen
            const containerWidth = previewContainerRef.current.offsetWidth;
            
            // Ein A4 Blatt ist bei 96 DPI ca. 794px breit. 
            // Wir ziehen 60px ab (für Padding links/rechts), damit es Luft hat.
            const invoiceBaseWidth = 794; 
            const availableWidth = containerWidth - 60; 

            // Skalierung berechnen
            let newScale = availableWidth / invoiceBaseWidth;
            
            // Begrenzung: Nicht größer als 100% (Originalgröße), damit es nicht unscharf wird
            // Aber auf Mobile darf es winzig werden.
            if (newScale > 1) newScale = 1;
            
            setPreviewScale(newScale);
        }
    };

    // Berechnung ausführen bei:
    // 1. Laden der Seite
    // 2. Ändern der Fenstergröße
    calculateScale();
    window.addEventListener('resize', calculateScale);

    // Aufräumen
    return () => window.removeEventListener('resize', calculateScale);
  }, [activeTab]); // Nur neu berechnen, wenn Tab gewechselt wird

  // Local Editor State
  // --- STATE DEFINITIONEN ---
  const [currentInvoice, setCurrentInvoice] = useState({
      number: '', 
      supplierId: 'main_profile',
      orderNumber: '',            // <--- NEU HINZUFÜGEN
      // NEU: Default auf HEUTE setzen
      date: new Date().toISOString().split('T')[0], 
      serviceDateMode: 'point', // Standard: Einzeldatum
      serviceDate: new Date().toISOString().split('T')[0], // Standard: Heute
      serviceDateStart: '',
      serviceDateEnd: '',
      
      customerId: '', 
      items: [], 
      notes: '', 
      type: 'invoice',
      countryZone: 'DE',
      
      // Neue Felder auch initialisieren
      paymentTerms: '14_days', 
      isServicePeriod: false,
      serviceDateStart: ''
  });
  const [currentExpense, setCurrentExpense] = useState(getEmptyExpense());

  // --- STATE VAT EU Länder ---
  const [vatRates, setVatRates] = useState([]); // <--- NEU
  const [settingsTab, setSettingsTab] = useState('profile'); // <--- NEU ('profile' oder 'vat')

  // --- HELPER FÜR DATENBANK-PFADE ---
  // Diese Funktion baut uns automatisch den Pfad zur aktuellen Firma
  const getCompanyCollection = (collectionName) => {
    if (!activeCompanyId) return null;
    return collection(db, 'companies', activeCompanyId, collectionName);
  };

  const getCompanyDoc = (collectionName, docId) => {
     if (!activeCompanyId) return null;
     return doc(db, 'companies', activeCompanyId, collectionName, docId);
  };

  function getEmptyInvoice() {
    return {
      number: '', 
      date: new Date().toISOString().split('T')[0],
      serviceDate: new Date().toISOString().split('T')[0],
      supplierId: 'main_profile',
      customerId: '',
      countryZone: 'DE',
      ossCountryCode: '', // <--- NEU: Hier merken wir uns das Land (z.B. "AT" für Österreich)
      isPartial: false, 
      partialPercentage: '', 
      items: [{ id: Date.now(), itemId: '', description: '', quantity: 1, price: 0, taxRate: 19 }],
      notes: 'Zahlbar innerhalb von 14 Tagen ohne Abzug.',
    };
  }

  function getEmptyExpense() {
    return {
      number: '', 
      date: new Date().toISOString().split('T')[0],
      vendorId: '',
      description: '',
      category: 'Wareneinkauf',
      netto: 0,
      taxRate: 19,
      notes: ''
    };
  }

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      setAuthError('');
    } catch (error) {
      console.error(error);
      setAuthError('Google Login fehlgeschlagen.');
    }
  };

  const handleEmailAuth = async (e) => {
      e.preventDefault();
      setAuthError('');
      try {
        if (authMode === 'login') {
          // Login bleibt gleich
          await signInWithEmailAndPassword(auth, email, password);
        } else {
          // --- HIER IST DIE ÄNDERUNG ---
          // 1. User im Auth-System erstellen
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const newUser = userCredential.user;

          // 2. SOFORT einen Eintrag in der 'users' Datenbank-Collection erstellen
          // Damit er im Admin-Dashboard sichtbar wird
          await setDoc(doc(db, 'users', newUser.uid), {
            email: newUser.email,
            role: 'guest',       // Erstmal Gast, bis du ihn zuweist
            companyId: null,     // Noch keine Firma
            createdAt: new Date().toISOString()
          });
          
          // Optional: Automatisch einloggen oder Meldung zeigen
          alert("Registrierung erfolgreich! Bitte warten Sie auf Freischaltung durch den Admin.");
        }
      } catch (error) {
        console.error(error);
        setAuthError(error.message);
      }
    };

  const handleLogout = async () => {
    await signOut(auth);
    setProfile(null);
    setCustomers([]); setItems([]); setInvoices([]); setExpenses([]);
  };

  // --- Real-time Sync (NEU) ---
  useEffect(() => {
    // Wir laden nur Daten, wenn wir eingeloggt sind UND eine Firma aktiv ist
    if (!user || !activeCompanyId) return;

    const syncCollection = (name, setter) => {
      const colRef = getCompanyCollection(name);
      if (!colRef) return; 
      
      return onSnapshot(colRef, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setter(data);
      });
    };

    // --- HIER HAST DU DEN TEIL ERSETZT ---
    const syncSettings = () => {
       // A) Profil laden (wie bisher)
       const unsubProfile = onSnapshot(doc(db, 'companies', activeCompanyId, 'settings', 'profile'), (docSnap) => {
         if (docSnap.exists()) {
            setProfile({ id: docSnap.id, ...docSnap.data() });
         } else {
            setProfile(null);
         }
       });

       // B) NEU: Steuerraten laden
       const unsubVat = onSnapshot(doc(db, 'companies', activeCompanyId, 'settings', 'taxRates'), (docSnap) => {
         if (docSnap.exists() && docSnap.data().rates) {
            // Wenn schon gespeichert, laden wir die
            setVatRates(docSnap.data().rates);
         } else {
            // Wenn leer (erster Start), nehmen wir die Defaults
            setVatRates(DEFAULT_EU_RATES);
         }
       });

       // WICHTIG: Beide beenden beim Aufräumen
       return () => { unsubProfile(); unsubVat(); };
    };
    // -------------------------------------

    // Alle Abos starten
    const unsubs = [
      syncCollection('customers', setCustomers),
      syncCollection('vendors', setVendors),
      syncCollection('suppliers', setSuppliers),
      syncCollection('items', setItems),
      syncCollection('invoices', setInvoices),
      syncCollection('expenses', setExpenses),
      syncSettings() // Das ruft jetzt deine neue Funktion auf
    ];

    // Aufräumen beim Verlassen
    return () => unsubs.forEach(unsub => unsub && unsub());
  }, [user, activeCompanyId]);

  // --- PDF Generation ---
  // --- PDF GENERATION (OPTIMIERT: JPEG + SMART SCALING) ---
  // --- PDF GENERATION (JPEG 100% + FIX FÜR 2. SEITE) ---
  const generatePDF = async (elementId, fileName) => {
    const input = document.getElementById('invoice-preview-hidden');
    if (!input) { alert("Vorschau nicht gefunden."); return; }
    
    // Schatten entfernen
    const originalShadow = input.style.boxShadow;
    input.style.boxShadow = 'none';
    
    try {
        setLoading(true);

        const canvas = await html2canvas(input, { 
            scale: 2, 
            useCORS: true, 
            logging: false,
            backgroundColor: '#ffffff' 
        });

        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();   // 210mm
        const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
        
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;

        // Hier nutzen wir deine 100% Qualität (1.0), da die Größe ok ist
        const imgData = canvas.toDataURL('image/jpeg', 1.0);

        let heightLeft = imgHeight;
        let position = 0;

        // Erste Seite drucken
        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfHeight;

        // --- FIX: TOLERANZ EINBAUEN ---
        // Statt "heightLeft > 0" schreiben wir "heightLeft > 1" (1mm Puffer)
        // Das verhindert, dass wegen 0.5mm Überhang eine leere Seite kommt.
        while (heightLeft > 1) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfHeight;
        }
        
        pdf.save(fileName);

    } catch (err) {
        console.error("PDF Error:", err);
        alert("Fehler beim Erstellen des PDFs.");
    } finally {
        input.style.boxShadow = originalShadow;
        setLoading(false);
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

  // --- CSV EXPORT FUNKTION (FIX: NUR AUSGEWÄHLTE) ---
  const downloadInvoicesCSV = () => {
    // 1. Welche Rechnungen sollen exportiert werden?
    // Wenn Auswahl vorhanden ist, filtern wir. Sonst nehmen wir alle (Fallback).
    const invoicesToExport = selectedInvoices.length > 0 
        ? processedInvoices.filter(inv => selectedInvoices.includes(inv.id))
        : processedInvoices;

    if (invoicesToExport.length === 0) {
        alert("Keine Rechnungen zum Exportieren vorhanden.");
        return;
    }

    // 2. CSV Header
    const headers = [
      "Rechnungsdatum",
      "Rechnungsnummer",
      "Leistungsbeginn",
      "Leistungsende",
      "Netto",
      "Steuer",
      "Brutto",
      "Sollkonto (Debitor)",
      "Habenkonto (Erlös)",
      "Steuerschlüssel",
      "Bestimmungsland (OSS)",
      "Steuersatz (OSS/Inland)",
      "Status"
    ];

    // 3. Daten aufbereiten (Wir iterieren jetzt über invoicesToExport!)
    const csvRows = invoicesToExport.map(inv => {
      const c = inv.customerSnap || {};
      const t = inv.totals || { netto: 0, taxTotal: 0, brutto: 0 };
      
      const formatDate = (dateStr) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString('de-DE');
      };

      const formatNumber = (num) => {
        if (num === undefined || num === null) return '0,00';
        return num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      };

      // --- TEILBETRÄGE BERECHNEN ---
      let exportNetto = t.netto;
      let exportTax = t.taxTotal;
      let exportBrutto = t.brutto;

      if (inv.isPartial && inv.partialPercentage) {
          const factor = inv.partialPercentage / 100;
          exportNetto = exportNetto * factor;
          exportTax = exportTax * factor;
          exportBrutto = exportBrutto * factor;
      }

      // --- KONTEN & SZENARIO ---
      let revenueAccount = '4400'; 
      const scenario = inv.countryZone || 'DE';

      switch (scenario) {
        case 'DE': revenueAccount = '4400'; break;
        case 'EU_REV': revenueAccount = '4125'; break;
        case 'EU_OSS': revenueAccount = '4320'; break;
        case 'NON_EU': revenueAccount = '4120'; break;
        case 'EU_TRI': revenueAccount = '4130'; break;
        case 'small_business': revenueAccount = '4185'; break;
        default: revenueAccount = '4400';
      }

      const taxKey = scenario === 'EU_OSS' ? '240' : '';

      const usedRates = Object.keys(t.taxGroups || {}).map(k => parseFloat(k));
      const mainRate = usedRates.length > 0 ? Math.max(...usedRates) : 0;

      // --- DATUMS LOGIK ---
      let dateStart = '';
      let dateEnd = '';

      if (inv.serviceDateMode === 'period') {
          dateStart = formatDate(inv.serviceDateStart);
          dateEnd = formatDate(inv.serviceDateEnd);
      } else {
          dateStart = ''; 
          dateEnd = inv.serviceDate ? formatDate(inv.serviceDate) : formatDate(inv.date);
      }

      // --- ZEILE ZUSAMMENBAUEN ---
      return [
        formatDate(inv.date),
        inv.number,
        dateStart,
        dateEnd,
        formatNumber(exportNetto),
        formatNumber(exportTax),
        formatNumber(exportBrutto),
        c.number || c.customerNumber || c.company || c.lastName || 'Keine Kundennummer',
        revenueAccount,
        taxKey,
        scenario === 'EU_OSS' ? (inv.ossCountryCode || '') : '', 
        formatNumber(mainRate) + '%', 
        inv.status === 'paid' ? 'Bezahlt' : 'Offen'
      ].map(field => `"${field}"`).join(';');
    });

    // 4. Datei generieren
    const csvContent = "\uFEFF" + [headers.join(';'), ...csvRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Dateiname anpassen (z.B. "Export_3_Rechnungen...")
    const count = invoicesToExport.length;
    link.setAttribute('download', `Buchungsexport_${count}_Rechnungen_${new Date().toISOString().slice(0,10)}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

  // --- Logic Helpers (MIT KOMMA-FIX) ---
  const handleSaveData = async (colName, data) => {
    if (!activeCompanyId) return;
    
    try {
      // 1. Kopie der Daten erstellen, damit wir sie bearbeiten können
      let cleanData = { ...data };

      // 2. SPEZIAL-LOGIK FÜR ARTIKEL (Preise bereinigen)
      if (colName === 'items' && cleanData.price !== undefined) {
          // Egal was kommt, mach einen String draus, ersetze Komma durch Punkt
          const priceStr = String(cleanData.price).replace(',', '.');
          // Mach eine echte Zahl daraus für die Datenbank
          cleanData.price = parseFloat(priceStr);
          
          // Falls ungültig (z.B. Text eingegeben), auf 0 setzen oder Fehler werfen
          if (isNaN(cleanData.price)) cleanData.price = 0;
      }

      // 3. Speichern wie gewohnt
      if (data.id) {
        // Update existierendes Dokument
        await updateDoc(getCompanyDoc(colName, data.id), cleanData);
      } else {
        // Neues Dokument erstellen
        await addDoc(getCompanyCollection(colName), cleanData);
      }
    } catch (e) { 
      console.error("Fehler beim Speichern:", e); 
      alert("Fehler beim Speichern: " + e.message);
    }
  };

  // --- LOGO UPLOAD FUNKTION ---
  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !activeCompanyId) return;

    try {
      // Pfad: logos/Firma-ID/dateiname
      const storageRef = ref(storage, `logos/${activeCompanyId}/logo_${Date.now()}`);
      
      setLoading(true);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);
      
      // Speichere die URL direkt im Profil
      const updatedProfile = { ...profile, logoUrl: downloadURL };
      setProfile(updatedProfile);
      
      // Speichere es auch sofort in der Datenbank
      await handleSaveProfile(updatedProfile);
      
      setLoading(false);
    } catch (error) {
      console.error("Upload Fehler:", error);
      alert("Fehler beim Hochladen des Logos.");
      setLoading(false);
    }
  };

  // --- LOGO LÖSCHEN FUNKTION ---
  const handleDeleteLogo = async () => {
    if (!window.confirm("Möchten Sie das Firmenlogo wirklich entfernen?")) return;

    try {
      setLoading(true);
      
      // 1. Profil lokal aktualisieren (URL entfernen)
      const updatedProfile = { ...profile, logoUrl: null };
      setProfile(updatedProfile);
      
      // 2. Datenbank aktualisieren
      await setDoc(doc(db, 'companies', activeCompanyId, 'settings', 'profile'), updatedProfile, { merge: true });
      
      setLoading(false);
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      alert("Fehler beim Entfernen des Logos.");
      setLoading(false);
    }
  };

  // --- UPDATED: PROFIL SPEICHERN (MIT FLEXIBLER NACHRICHT) ---
  const handleSaveProfile = async (data, successMessage = "Firmenprofil gespeichert!") => {
    if (!activeCompanyId) return;
    try { 
      // Profil speichern unter companies/{id}/settings/profile
      await setDoc(doc(db, 'companies', activeCompanyId, 'settings', 'profile'), data, { merge: true }); 
      alert(successMessage); // <--- Hier nutzen wir jetzt die variable Nachricht
    } catch (e) { 
      console.error(e); 
      alert("Fehler beim Speichern.");
    }
  };

  const handleSaveVatRates = async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
        await setDoc(doc(db, 'companies', activeCompanyId, 'settings', 'taxRates'), { 
            rates: vatRates,
            updatedAt: new Date().toISOString()
        });
        alert("Steuersätze erfolgreich gespeichert!");
    } catch(e) {
        console.error(e);
        alert("Fehler beim Speichern der Steuersätze.");
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (colName, id) => {
    if (!activeCompanyId) return;
    if(!window.confirm("Wirklich löschen?")) return;
    await deleteDoc(getCompanyDoc(colName, id));
  };

  // --- FUNKTION: NÄCHSTE ABSCHLAGSRECHNUNG VORBEREITEN ---
  const handleNextPartial = (parentInvoice) => {
    // 1. Prüfen, ob das Format passt (wir erwarten ...-ZAHL)
    const parts = parentInvoice.number.split('-');
    const lastPart = parts[parts.length - 1]; // z.B. "01"
    
    if (isNaN(lastPart)) {
        alert("Diese Rechnungsnummer hat kein erkanntes Suffix (z.B. -01). Kann keine Folgerechnung erstellen.");
        return;
    }

    // 2. Suffix erhöhen (01 -> 02)
    const nextSuffixInt = parseInt(lastPart, 10) + 1;
    const nextSuffixStr = String(nextSuffixInt).padStart(2, '0'); // "02"
    
    // 3. Neue Nummer zusammenbauen (Alten Suffix abschneiden, neuen dran)
    // Wir nehmen alle Teile außer dem letzten und fügen den neuen hinzu
    const baseNumber = parts.slice(0, parts.length - 1).join('-');
    const nextNumber = `${baseNumber}-${nextSuffixStr}`;

    // 4. Editor vorbereiten
    // Wir kopieren die wichtigsten Daten (Kunde, Projektbeschreibung), aber setzen Preise auf 0
    // ... in handleNextPartial ...
    setCurrentInvoice({
        ...getEmptyInvoice(), 
        customerId: parentInvoice.customerId,
        supplierId: parentInvoice.supplierId,
        countryZone: parentInvoice.countryZone,
        isPartial: true,      
        number: nextNumber,   
        partialPercentage: '', // <--- DIESE ZEILE HINZUFÜGEN (Reset für neue Rechnung)
        // Wir kopieren alle Artikel 1:1, geben ihnen aber neue IDs für React
        items: parentInvoice.items.map((item, index) => ({
            ...item,
            id: Date.now() + index // Neue ID generieren
        })),
        notes: `Teilrechnung Nr. ${nextSuffixInt} zur Beauftragung ${baseNumber}`
    });

    // 5. Zum Editor wechseln
    setActiveTab('invoice-editor');
    // Nach oben scrollen (für UX)
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // --- PROFESSIONAL STORNO / GUTSCHRIFT ---
  const handleStorno = async (originalInvoice) => {
      if(!window.confirm(`Möchten Sie für Rechnung ${originalInvoice.number} eine Rechnungskorrektur (Gutschrift) erstellen?`)) return;
      
      setLoading(true);

      // 1. Neue Nummer generieren (aus GS-Kreis)
      const cnPrefix = profile?.creditNotePrefix || 'GS';
      const cnNextCount = parseInt(profile?.nextCreditNoteNumber || '1000', 10);
      const newNumber = `${cnPrefix}-${String(cnNextCount).padStart(4, '0')}`;

      // 2. Das Korrektur-Objekt bauen
      const stornoInvoice = {
          ...originalInvoice,
          // WICHTIG: Eigene ID generieren, sonst überschreiben wir das Original!
          // Wir lassen Firestore die ID beim 'addDoc' generieren, also hier keine ID setzen.
          
          type: 'credit_note', // <--- MARKER: Das ist eine Gutschrift
          number: newNumber,
          date: new Date().toISOString().split('T')[0],
          
          // Referenz auf Original
          relatedInvoiceNumber: originalInvoice.number, 
          
          // Anmerkungstext anpassen
          notes: `Rechnungskorrektur zur Rechnung Nr. ${originalInvoice.number} vom ${new Date(originalInvoice.date).toLocaleDateString('de-DE')}.`,
          
          // Preise invertieren (Negativ machen)
          items: originalInvoice.items.map((item, idx) => ({
              ...item,
              id: Date.now() + idx, // Neue IDs für React
              price: -Math.abs(item.price) // Sicherstellen, dass es negativ ist
          })),
          
          createdAt: new Date().toISOString()
      };
      
      // ID löschen, damit addDoc eine neue macht
      delete stornoInvoice.id; 

      // Totals neu berechnen (Negativ)
      // Wir kopieren die Logik hier kurz, weil 'totals' ein Hook ist und hier nicht direkt verfügbar
      let netto = 0;
      let taxGroups = {};
      stornoInvoice.items.forEach(item => {
        const lineNetto = item.quantity * item.price;
        netto += lineNetto;
        // Steuerlogik beachten (vereinfacht, übernimmt Prozente vom Original)
        const rate = item.taxRate; // Hier könnte man die komplexe Logic wiederholen, aber Kopie reicht meist
        taxGroups[rate] = (taxGroups[rate] || 0) + (lineNetto * (rate / 100));
      });
      const taxTotal = Object.values(taxGroups).reduce((a, b) => a + b, 0);
      stornoInvoice.totals = { netto, taxGroups, taxTotal, brutto: netto + taxTotal };

      try {
          // A) Speichern
          await addDoc(getCompanyCollection('invoices'), stornoInvoice);

          // B) Zähler für Gutschriften erhöhen
          const newProfileData = { ...profile, nextCreditNoteNumber: cnNextCount + 1 };
          setProfile(newProfileData);
          await setDoc(doc(db, 'companies', activeCompanyId, 'settings', 'profile'), { nextCreditNoteNumber: cnNextCount + 1 }, { merge: true });

          alert(`Rechnungskorrektur ${newNumber} erfolgreich erstellt!`);
          
          // Optional: Ansicht aktualisieren oder zur Liste springen
          // setActiveTab('invoice-history'); 

      } catch(e) {
          console.error(e);
          alert("Fehler beim Erstellen der Korrektur: " + e.message);
      } finally {
          setLoading(false);
      }
  };

  const getDisplayName = (r) => {
    if (!r) return '';
    if (r.description) return r.description;
    return r.company ? r.company : `${r.firstName || ''} ${r.lastName || ''}`.trim();
  };

  const getSenderData = (inv) => {
    const invoiceToCheck = inv || currentInvoice;
    if (invoiceToCheck.supplierId === 'main_profile') return profile || {};
    return suppliers.find(s => s.id === invoiceToCheck.supplierId) || {};
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

  // --- INTELLIGENTE STEUER-BERECHNUNG (OSS / REV / EXPORT) ---
  const totals = useMemo(() => {
    let netto = 0;
    let taxGroups = {};

    // Helper: Findet den passenden OSS-Satz basierend auf dem Ursprungs-Artikel
    const getOssRate = (originalRate) => {
        if (!currentInvoice.ossCountryCode) return 0;
        
        // Das Land aus deinen Einstellungen suchen
        const countryData = vatRates.find(r => r.code === currentInvoice.ossCountryCode);
        
        // Fallback: Wenn Land nicht gefunden, 0% (oder man könnte warnen)
        if (!countryData) return 0;

        // MAPPER: Wir müssen wissen: War das ein Standard- oder ein ermäßigter Artikel?
        // Wir nutzen eine Heuristik:
        // >= 16% -> Standard (z.B. 19% DE -> 27% HU)
        // > 0% und < 16% -> Ermäßigt (z.B. 7% DE -> 5% HU)
        // 0% -> Bleibt 0%
        
        if (originalRate >= 16) return countryData.standard;
        if (originalRate > 0) return countryData.reduced1; // Wir nehmen hier 'reduced1' als Standard-Ermäßigt
        return 0;
    };

    currentInvoice.items.forEach(item => {
      const lineNetto = item.quantity * item.price;
      netto += lineNetto;
      
      // --- STEUERSATZ ENTSCHEIDUNG ---
      let rate = 0;
      
      switch(currentInvoice.countryZone) {
          case 'DE': 
              // Inland: Wir nehmen den Satz, der am Artikel steht
              rate = item.taxRate; 
              break;
          
          case 'EU_REV': 
          case 'EU_TRI': // <--- NEU: Auch Dreieck ist steuerfrei (0%)
          case 'NON_EU': 
              // B2B Ausland & Export: Immer steuerfrei
              rate = 0; 
              break;
          
          case 'EU_OSS':
              // OSS: Wir rechnen den Satz um
              rate = getOssRate(item.taxRate);
              break;
              
          default:
              rate = item.taxRate;
      }
      // -------------------------------

      taxGroups[rate] = (taxGroups[rate] || 0) + (lineNetto * (rate / 100));
    });

    const taxTotal = Object.values(taxGroups).reduce((a, b) => a + b, 0);
    return { netto, taxGroups, taxTotal, brutto: netto + taxTotal };
  }, [currentInvoice, vatRates]); // <--- WICHTIG: 'vatRates' muss hier dabei sein!

  // Berechnung Incoming (Expense)
  const expenseTotals = useMemo(() => {
    const netto = parseFloat(currentExpense.netto) || 0;
    const tax = netto * (currentExpense.taxRate / 100);
    return { netto, tax, brutto: netto + tax };
  }, [currentExpense]);

  // Hilfsfunktion für Header-Klick
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // --- LOGIK: FILTERN & SORTIEREN (Hier ist der richtige Ort!) ---
  const processedInvoices = useMemo(() => {
    let data = invoices ? [...invoices] : [];

    // 1. Globaler Suchschlitz
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(inv => 
        (inv.number && inv.number.toLowerCase().includes(lower)) ||
        (inv.customerSnap && getDisplayName(inv.customerSnap).toLowerCase().includes(lower)) ||
        (inv.totals?.brutto && inv.totals.brutto.toString().includes(lower))
      );
    }

    // 2. Filter: Kunde
    if (filterCustomer) {
      data = data.filter(inv => 
        inv.customerSnap && getDisplayName(inv.customerSnap).toLowerCase().includes(filterCustomer.toLowerCase())
      );
    }

    // 3. Filter: Datums-Zeitraum
    if (filterDateStart) {
      data = data.filter(inv => inv.date >= filterDateStart);
    }
    if (filterDateEnd) {
      data = data.filter(inv => inv.date <= filterDateEnd);
    }

    // 4. Sortierung
    if (sortConfig.key) {
      data.sort((a, b) => {
        let aValue = '', bValue = '';

        switch (sortConfig.key) {
          case 'number': 
            aValue = a.number || ''; bValue = b.number || ''; break;
          case 'date': 
            aValue = new Date(a.date).getTime(); bValue = new Date(b.date).getTime(); break;
          case 'customer': 
            aValue = getDisplayName(a.customerSnap).toLowerCase(); bValue = getDisplayName(b.customerSnap).toLowerCase(); break;
          case 'netto': 
            aValue = a.totals?.netto || 0; bValue = b.totals?.netto || 0; break;
          case 'tax': 
            aValue = a.totals?.taxTotal || 0; bValue = b.totals?.taxTotal || 0; break;
          case 'brutto': 
            aValue = a.totals?.brutto || 0; bValue = b.totals?.brutto || 0; break;
          case 'partial': 
            aValue = a.partialPercentage || 0; bValue = b.partialPercentage || 0; break;
          default: return 0;
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return data;
  }, [invoices, searchTerm, filterCustomer, filterDateStart, filterDateEnd, sortConfig]);

  // --- RECHNUNG SPEICHERN & WEITERMACHEN (KORRIGIERT) ---
  const saveInvoice = async () => {
    // 1. Validierung: Wir nutzen activeCompanyId aus dem useAuth Hook
    if (!activeCompanyId) {
        alert("Fehler: Keine aktive Firma gefunden.");
        return;
    }

    if (!currentInvoice.customerId) {
        alert("Bitte wähle einen Kunden aus.");
        return;
    }

    setLoading(true); // Ladeindikator an

    try {
        const companyId = activeCompanyId;

        // 2. Nummer generieren
        const prefix = profile?.invoicePrefix || 'RE';
        const currentNumCounter = parseInt(profile?.nextInvoiceNumber || '1000');
        const nextNumCounter = currentNumCounter + 1; 

        // Die Nummer für DIESE Rechnung
        const finalNumber = currentInvoice.number || (
            prefix + '-' + String(currentNumCounter).padStart(4, '0')
        );

        // 3. Datenpaket schnüren
        const invoiceData = {
            ...currentInvoice,
            number: finalNumber,
            // ID generieren
            id: currentInvoice.id || (finalNumber + (currentInvoice.isPartial ? '-part' : '')), 
            createdAt: new Date().toISOString(),
            status: 'open', 
            totals: totals, 
            serviceDate: currentInvoice.serviceDate || currentInvoice.date,
            
            customerSnap: customers.find(c => c.id === currentInvoice.customerId),
            companyId: companyId 
        };

        // 4. SPEICHERN: In die UNTER-SAMMLUNG der Firma schreiben!
        // Pfad: companies -> [ID] -> invoices -> [RechnungsID]
        const invoiceRef = doc(db, 'companies', companyId, 'invoices', invoiceData.id);
        await setDoc(invoiceRef, invoiceData);

        // 5. ZÄHLER UPDATEN: IM FIRMENPROFIL (Nicht im User!) [WICHTIGE ÄNDERUNG]
        // Wir aktualisieren das Dokument companies/[ID]/settings/profile
        const settingsRef = doc(db, 'companies', companyId, 'settings', 'profile');
        
        await updateDoc(settingsRef, {
            nextInvoiceNumber: nextNumCounter
        });
        
        // Lokales State Update, damit die UI sofort springt
        setProfile(prev => ({ ...prev, nextInvoiceNumber: nextNumCounter }));
        
        // 6. UI Feedback
        alert(`Rechnung ${finalNumber} gebucht!`);

        // 7. RESET (Im Editor bleiben, Nummer leeren für die nächste)
        setCurrentInvoice(prev => ({
            ...prev,
            id: null, 
            number: '', 
            date: new Date().toISOString().slice(0, 10),
            // Kunde & Artikel bleiben erhalten für Massenerfassung
        }));
        
    } catch (error) {
        console.error("Fehler beim Speichern:", error);
        alert("Speicherfehler: " + error.message);
    } finally {
        setLoading(false);
    }
  };

  const saveExpense = async () => {
    if (!user || !currentExpense.vendorId) { alert("Bitte Lieferant auswählen!"); return; }
    setLoading(true);
    const fullExpense = {
        ...currentExpense,
        totals: expenseTotals,
        vendorSnap: vendors.find(v => v.id === currentExpense.vendorId),
        createdAt: new Date().toISOString()
    };
    await handleSaveData('expenses', fullExpense);
    setLoading(false);
    setCurrentExpense(getEmptyExpense());
    setActiveTab('expense-history');
  };

  // --- FIELDS DEFINITION ---
  const addressFields = [
    { key: 'number', label: 'Nr.', placeholder: '1001', halfWidth: true, required: true },
    { key: 'isCollective', label: 'Ist Sammelkunde (Laufkundschaft)?', type: 'checkbox' },
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
    { key: 'email', label: 'E-Mail', halfWidth: true },
    { key: 'phone', label: 'Telefon', halfWidth: true },
    { key: 'taxId', label: 'USt-IdNr.', fullWidth: true, required: true },
    { key: 'bankName', label: 'Bankname' },
    { key: 'iban', label: 'IBAN' },
    { key: 'bic', label: 'BIC' }
  ];

  // --- NEUE LISTE: VOLLES FIRMENPROFIL (für "Eigene Profile") ---
  const fullProfileFields = [
    // Allgemeine Daten
    { key: 'company', label: 'Firmenname', fullWidth: true, required: true },
    { key: 'street', label: 'Straße', halfWidth: true, required: true },
    { key: 'houseNumber', label: 'Hausnr.', required: true },
    { key: 'addressSupplement', label: 'Adresszusatz', fullWidth: true },
    { key: 'zip', label: 'PLZ', required: true },
    { key: 'city', label: 'Ort', halfWidth: true, required: true },
    { key: 'country', label: 'Land', fullWidth: true, required: true },

    // Kontakt & Steuer
    { key: 'taxId', label: 'USt-IdNr.', fullWidth: true, required: true },
    { key: 'email', label: 'E-Mail (für Rechnung)', fullWidth: true },
    { key: 'phone', label: 'Telefon', fullWidth: true },

    // Geschäftsführung
    { key: 'ceoFirstName', label: 'Geschäftsführer Vorname', halfWidth: true, required: true },
    { key: 'ceoLastName', label: 'Geschäftsführer Nachname', halfWidth: true, required: true },

    // Bank & Register
    { key: 'bankName', label: 'Bankname', fullWidth: true, required: true },
    { key: 'iban', label: 'IBAN', fullWidth: true, required: true },
    { key: 'bic', label: 'BIC', fullWidth: true, required: true },
    { key: 'registerCourt', label: 'Registergericht', halfWidth: true, required: true },
    { key: 'registerNumber', label: 'Handelsregisternummer', halfWidth: true, required: true },
  ];

  const itemFields = [
    { key: 'number', label: 'Artikelnummer', placeholder: 'ART-001', halfWidth: true, required: true },
    { key: 'ean', label: 'EAN / GTIN', placeholder: 'Optional', halfWidth: true },
    { key: 'description', label: 'Artikelbezeichnung', fullWidth: true, required: true },
    { key: 'price', label: 'Standardpreis (Netto)', placeholder: '0.00', halfWidth: true, required: true },
    { key: 'unit', label: 'Einheit', placeholder: 'Stk, Std, m', halfWidth: true, required: true },
  ];

  // --- COMPONENT: ModuleManager ---
  const ModuleManager = ({ title, data, fields, collectionName, icon: Icon }) => {
    const [editItem, setEditItem] = useState(null);
    const fileInputRef = useRef(null);
    const handleFileChange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const text = await file.text(); await processCSVImport(text, fields, collectionName); e.target.value = null;
    };
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2"><Icon className="w-6 h-6 text-blue-600"/> {title}</h2>
          <div className="flex gap-2">
            <button onClick={() => downloadCSVTemplate(fields, collectionName)} className="text-slate-500 hover:text-blue-600 px-3 py-2 text-sm flex items-center gap-2 underline"><FileDown className="w-4 h-4"/> Vorlage laden</button>
            <input type="file" ref={fileInputRef} hidden accept=".csv" onChange={handleFileChange} />
            <button onClick={() => fileInputRef.current.click()} className="bg-white border text-slate-600 px-3 py-2 rounded-lg hover:bg-slate-50 transition shadow-sm flex items-center gap-2 text-sm font-medium"><Upload className="w-4 h-4"/> CSV Import</button>
            <button onClick={() => setEditItem({})} className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition shadow-md hover:shadow-lg flex items-center gap-2 text-sm font-medium"><Plus className="w-4 h-4"/> Neu</button>
          </div>
        </div>
        {editItem && (
          <div className="mb-8 p-6 bg-slate-50 rounded-lg border shadow-inner animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {fields.map(f => (
                <div key={f.key} className={f.fullWidth ? "md:col-span-2 lg:col-span-4" : f.halfWidth ? "md:col-span-1 lg:col-span-2" : "col-span-1"}>
                   {f.type === 'checkbox' ? (
                       // --- FALL A: ES IST EINE CHECKBOX ---
                       <div className="flex items-center gap-3 h-full mt-6 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition" onClick={() => setEditItem({...editItem, [f.key]: !editItem[f.key]})}>
                           <input 
                             type="checkbox" 
                             className="w-5 h-5 accent-blue-600 cursor-pointer"
                             checked={editItem[f.key] || false} 
                             onChange={e => setEditItem({...editItem, [f.key]: e.target.checked})}
                           />
                           <span className="text-sm font-bold text-slate-700 select-none">
                             {f.label}
                           </span>
                       </div>
                   ) : (
                       // --- FALL B: NORMALES TEXTFELD ---
                       <>
                           <label className="block text-xs font-semibold text-slate-500 mb-1">
                               {f.label} {f.required && <span className="text-red-500">*</span>}
                           </label>
                           <input 
                             type={f.type || 'text'} // Bleibt 'text', damit Kommas erlaubt sind
                             inputMode={f.key === 'price' ? 'decimal' : 'text'} // Handys zeigen Zahlentastatur
                             placeholder={f.placeholder || f.label} 
                             className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-200 outline-none bg-white shadow-sm" 
                             
                             // WICHTIG: Wenn wir ein Item bearbeiten, das schon eine Zahl ist (19.99),
                             // wandeln wir es für die Anzeige kurz in einen String mit Komma um (19,99).
                             // So sieht es für den Nutzer deutsch aus.
                             value={
                                 editItem[f.key] !== undefined 
                                   ? (f.key === 'price' 
                                       ? String(editItem[f.key]).replace('.', ',') 
                                       : editItem[f.key]) 
                                   : ''
                             } 
                             
                             onChange={e => setEditItem({...editItem, [f.key]: e.target.value})}
                           />
                       </>
                   )}
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
          {data.length === 0 && <p className="text-center text-slate-400 py-8 italic">Keine Einträge.</p>}
        </div>
      </div>
    );
  };

  // --- COMPONENT: Invoice Preview Render (For Modal & Editor) ---
  const InvoicePaper = ({ data, idPrefix }) => {
      const safeData = data || {};
      const safeTotals = safeData.totals || { netto: 0, taxGroups: {}, brutto: 0 };
      const safeItems = safeData.items || [];
      const sender = getSenderData(safeData);
      const customer = safeData.customerSnap;
  
      return (
        <div id={idPrefix} className="bg-white shadow-2xl rounded-sm p-12 text-[11px] leading-tight min-h-[900px] border relative mx-auto" style={{ width: '210mm', minHeight: '297mm' }}>
            
            {/* --- HEADER BEREICH --- */}
            <div className="flex justify-between mb-8">
              
              {/* LINKE SEITE: ABSENDER ZEILE & ADRESSFELD */}
              <div className="w-[45%]">
                  {/* Kleine Absenderzeile (Rücksendeadresse) */}
                  <div className="text-[9px] text-slate-400 underline mb-2 tracking-wide mt-12">
                      {!sender.company && !sender.firstName ? 'BITTE PROFIL EINSTELLEN' : `${getDisplayName(sender)} · ${sender.street || ''} ${sender.houseNumber || ''} · ${sender.zip || ''} ${sender.city || ''}`}
                  </div>

                  {/* Kundenadresse */}
                  {/* ANPASSUNG 1: 'mt-10' hinzugefügt für ca. 3 Zeilen Abstand */}
                  <div className="text-sm font-bold leading-relaxed text-slate-800 h-42 mt-14">
                      {/* Logik: Wenn 'manualName' existiert, nutze das. Sonst Datenbank-Daten. */}
                  
                      {/* Zeile 1: Firma / Name */}
                      <div className="font-bold text-slate-800">
                          {safeData.manualName || customer?.company || customer?.firstName + ' ' + customer?.lastName || 'Kunde unbekannt'}
                      </div>
                      
                      {/* Zeile 2: Ansprechpartner (Nur wenn nicht manuell) */}
                      {!safeData.manualName && customer?.firstName && customer?.company && (
                          <div className="text-slate-600">{customer.salutation} {customer.firstName} {customer.lastName}</div>
                      )}

                      {/* Zeile 3: Straße */}
                      <div className="mt-1">
                          {safeData.manualStreet || (customer?.street ? `${customer.street} ${customer.houseNumber || ''}` : '')}
                      </div>
                      
                      {/* Zeile 4: PLZ Ort */}
                      <div>
                          {safeData.manualZip || customer?.zip} {safeData.manualCity || customer?.city}
                      </div>

                      {/* Zeile 5: Land (Manuell > Kunde > Standard) */}
                      <div className="uppercase font-bold text-xs mt-1 text-slate-400">
                          {safeData.manualCountry || customer?.country || 'Deutschland'}
                      </div>

                      {/* NEU: USt-IdNr. des Kunden (falls vorhanden) */}
                      {customer?.taxId && (
                          <div className="mt-2 text-[10px] font-medium text-slate-500">
                              USt-IdNr.: {customer.taxId}
                          </div>
                      )}
                  </div>
              </div>
              
              {/* RECHTE SEITE: LOGO & INFORMATIONSBLOCK */}
              <div className="text-right w-[50%]">
                  {/* 1. Logo */}
                  {sender.logoUrl && (
                    <img src={sender.logoUrl} alt="Logo" className="h-16 mb-4 ml-auto object-contain" />
                  )}
                  
                  {/* 2. Titel & Rechnungsnummer */}
                  <h2 className="text-2xl font-black text-slate-800 tracking-tighter uppercase">
                      {safeData.type === 'credit_note' ? 'Rechnungskorrektur' : 'Rechnung'}
                  </h2>
                  <p className="text-slate-500 font-bold mb-2">{safeData.number}</p>
                  
                  {safeData.type === 'credit_note' && safeData.relatedInvoiceNumber && (
                      <div className="mb-2 p-1 bg-red-50 border border-red-100 rounded text-[9px] text-red-800 inline-block">
                          Korrektur zu Re-Nr. <strong>{safeData.relatedInvoiceNumber}</strong>
                      </div>
                  )}

                  {/* 3. Kontaktdaten (Tel/Email) */}
                  <div className="text-[9px] text-slate-400 mb-6">
                      {sender.phone && <p>Tel: {sender.phone}</p>}
                      {sender.email && <p>Email: {sender.email}</p>}
                      {sender.website && <p>Web: {sender.website}</p>}
                  </div>

                  {/* 4. INFORMATIONSBLOCK (Rechts) */}
                  <div className="mt-24 grid grid-cols-[auto_auto] gap-x-4 justify-end items-baseline text-sm">
                      
                      {/* Rechnungsdatum */}
                      <div className="text-slate-500 text-left">Rechnungsdatum:</div>
                      <div className="font-medium text-slate-700 text-right">
                          {new Date(safeData.date).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                      </div>

                      {/* --- HIER WURDE DAS LEISTUNGSDATUM GELÖSCHT --- */}

                      {/* Kundennummer */}
                      {sender?.showCustomerNumber && safeData.customerSnap?.number && (
                          <>
                            <div className="text-slate-500 text-left mt-1">Kundennummer:</div>
                            <div className="font-medium text-slate-700 text-right mt-1">
                                {safeData.customerSnap.number}
                            </div>
                          </>
                      )}

                      {/* Bestellnummer */}
                      {sender?.showOrderNumber && safeData.orderNumber && (
                          <>
                            <div className="text-slate-500 text-left mt-1">Bestellnummer:</div>
                            <div className="font-medium text-slate-700 text-right mt-1">
                                {safeData.orderNumber}
                            </div>
                          </>
                      )}
                  </div>

              </div>
          </div>

            {/* --- LEISTUNGSDATUM / ZEITRAUM (KORRIGIERT) --- */}
            <div className="mt-16 mb-4 text-sm text-slate-700">
                <span className="font-bold mr-2">
                    {safeData.serviceDateMode === 'period' ? 'Leistungszeitraum:' : 'Leistungsdatum:'}
                </span>
                <span>
                    {safeData.serviceDateMode === 'period' ? (
                        <>
                            {/* STARTDATUM */}
                            {safeData.serviceDateStart ? new Date(safeData.serviceDateStart).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '...'}
                            
                            <span className="mx-2">–</span> 
                            
                            {/* ENDDATUM */}
                            {safeData.serviceDateEnd ? new Date(safeData.serviceDateEnd).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '...'}
                        </>
                    ) : (
                        /* EINZELDATUM (Fallback auf Rechnungsdatum, falls leer) */
                        safeData.serviceDate 
                            ? new Date(safeData.serviceDate).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' })
                            : new Date(safeData.date).toLocaleDateString('de-DE', { year: 'numeric', month: '2-digit', day: '2-digit' })
                    )}
                </span>
            </div>

            {/* TABELLE (Jetzt direkt unter dem Header, da der Datumsblock weg ist) */}
            <table className="w-full mb-8 mt-4">
                <thead className="border-b-2 border-slate-900"><tr className="text-left font-bold"><th className="py-2">Pos</th><th className="py-2">Beschreibung</th><th className="py-2 text-right">Anz.</th><th className="py-2 text-right">Einzel</th><th className="py-2 text-right">Gesamt</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                    {safeItems.map((line, idx) => (
                        <tr key={line.id || idx}>
                            <td className="py-3 text-slate-400">{idx+1}</td>
                            <td className="py-3 font-semibold">{line.description || 'Leistung'}</td>
                            <td className="py-3 text-right">{line.quantity}</td>
                            <td className="py-3 text-right">{line.price.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                            <td className="py-3 text-right font-bold">{(line.quantity * line.price).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            
            {/* --- SUMMEN-BLOCK --- */}
            <div className="flex justify-end mb-12">
                <div className="w-72 space-y-2"> 
                    <div className="flex justify-between text-slate-500">
                        <span>Auftragswert Netto:</span>
                        <span>{safeTotals.netto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                    </div>
                    
                    {Object.entries(safeTotals.taxGroups || {}).map(([rate, val]) => (
                        <div key={rate} className="flex justify-between text-slate-500 italic">
                            <span>{rate == 0 ? 'Steuerfrei (0%)' : `MwSt ${rate}%`}:</span>
                            <span>{val.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                        </div>
                    ))}

                    <div className={`flex justify-between font-bold border-t border-slate-300 pt-2 ${safeData.isPartial && safeData.partialPercentage ? 'text-slate-500' : 'text-slate-900 text-sm'}`}>
                        <span>Gesamt-Auftragswert:</span>
                        <span>{safeTotals.brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                    </div>

                    {safeData.isPartial && safeData.partialPercentage && (
                        <div className="mt-4 bg-blue-50 p-3 rounded border border-blue-100 text-blue-900">
                            <div className="flex justify-between items-center text-xs mb-1">
                                <span className="font-bold">Angeforderter Abschlag:</span>
                                <span className="font-bold bg-white px-2 py-0.5 rounded border text-blue-600">
                                    {safeData.partialPercentage}%
                                </span>
                            </div>
                            <div className="flex justify-between items-center font-black text-lg border-t border-blue-200 pt-2 mt-2">
                                <span>FÄLLIGER BETRAG:</span>
                                <span>{(safeTotals.brutto * (safeData.partialPercentage / 100)).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                            </div>
                            {safeTotals.taxTotal > 0 && (
                                <div className="flex justify-end items-center gap-2 text-[10px] text-blue-500 mt-1">
                                    <span className="italic">Darin enthaltene MwSt:</span>
                                    <span className="font-bold">{(safeTotals.taxTotal * (safeData.partialPercentage / 100)).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</span>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {(!safeData.isPartial || !safeData.partialPercentage) && (
                         <div className="text-right text-[10px] text-slate-400 mt-1">Zahlbetrag</div>
                    )}
                </div>
            </div>

            {/* AUTOMATISCHE STEUER-HINWEISE */}
            <div className="mb-6 text-xs font-bold text-slate-700">
                {safeData.countryZone === 'EU_REV' && <p>Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge).</p>}
                {safeData.countryZone === 'EU_TRI' && <p>Innergemeinschaftliches Dreiecksgeschäft (§ 25b UStG). Steuerschuldnerschaft des letzten Abnehmers.</p>}
                {safeData.countryZone === 'NON_EU' && <p>Steuerfreie Ausfuhrlieferung (§ 4 Nr. 1a UStG).</p>}
                {safeData.countryZone === 'EU_OSS' && safeData.ossCountryCode && <p>Die Umsatzsteuer wurde gemäß dem Bestimmungslandprinzip (OSS) für {safeData.ossCountryCode} berechnet.</p>}
            </div>

            {/* ZAHLUNGSBEDINGUNGEN & BANKDATEN LOGIK */}
            <div className="mt-8 pt-4 border-t border-slate-200 text-sm text-slate-600">
                <p className="font-bold mb-2">
                    {safeData.paymentTerms === 'paid' && "Der Rechnungsbetrag wurde bereits dankend erhalten."}
                    {safeData.paymentTerms === '14_days' && `Zahlbar innerhalb von 14 Tagen ohne Abzug bis zum ${new Date(new Date(safeData.date).getTime() + 14*24*60*60*1000).toLocaleDateString('de-DE')}.`}
                    {safeData.paymentTerms === '7_days' && `Zahlbar innerhalb von 7 Tagen ohne Abzug bis zum ${new Date(new Date(safeData.date).getTime() + 7*24*60*60*1000).toLocaleDateString('de-DE')}.`}
                    {safeData.paymentTerms === '0_days' && `Zahlbar ab sofort an das folgende Bankkonto`}
                    {safeData.paymentTerms === 'sepa_7' && "Der Rechnungsbetrag wird per Lastschrift eingezogen."}
                </p>

                {safeData.paymentTerms !== 'paid' && (
                    <div className="mt-4 bg-slate-50 p-4 rounded text-xs flex gap-8">
                        {(safeData.paymentTerms === '14_days' || safeData.paymentTerms === '7_days' || safeData.paymentTerms === '0_days') && (
                            <>
                                <div><span className="block text-slate-400 uppercase tracking-wider font-bold text-[10px]">Bankverbindung</span><span className="font-bold text-slate-700">{profile?.bankName || 'Bank nicht hinterlegt'}</span></div>
                                <div><span className="block text-slate-400 uppercase tracking-wider font-bold text-[10px]">IBAN</span><span className="font-mono text-slate-700">{profile?.iban || '-'}</span></div>
                                <div><span className="block text-slate-400 uppercase tracking-wider font-bold text-[10px]">BIC</span><span className="font-mono text-slate-700">{profile?.bic || '-'}</span></div>
                            </>
                        )}
                        {safeData.paymentTerms === 'sepa_7' && (
                             <>
                                <div className="text-blue-800">
                                    <span className="block text-blue-400 uppercase tracking-wider font-bold text-[10px]">Abbuchung von Konto</span>
                                    {/* KORREKTUR: Nutze 'customer' (oder safeData.customerSnap) statt safeData.customer */}
                                    <span className="font-bold block">
                                        {customer?.bankName || 'Bank nicht hinterlegt'}
                                    </span>
                                    <span className="font-mono block">
                                        {customer?.iban || 'IBAN nicht hinterlegt'}
                                    </span>
                                    {customer?.bic && (
                                        <span className="font-mono block text-xs">BIC: {customer.bic}</span>
                                    )}
                                </div>
                                <div className="text-blue-800"><span className="block text-blue-400 uppercase tracking-wider font-bold text-[10px]">Mandatsreferenz</span><span className="font-bold">Re-{safeData.number}</span></div>
                             </>
                        )}
                    </div>
                )}
            </div>

            {/* ANMERKUNGEN */}
            {safeData.notes && (
                <div className="mb-12 pr-12 text-xs text-slate-600 whitespace-pre-wrap leading-relaxed mt-4">
                    {safeData.notes}
                </div>
            )}

            {/* ABSOLUTE FUßZEILE */}
            <div className="absolute bottom-8 left-12 right-12 border-t pt-4 grid grid-cols-3 gap-4 text-[8px] text-slate-500">
                <div>
                    {!sender.company && !sender.firstName ? <span className="text-red-300">Profil fehlt</span> : (
                        <><p className="font-bold mb-1 text-slate-800">{getDisplayName(sender)}</p><p>{sender.street} {sender.houseNumber}</p><p>{sender.addressSupplement}</p><p>{sender.zip} {sender.city}</p><p>{sender.country}</p><p className="mt-2">USt-IdNr.: {sender.taxId || '-'}</p></>
                    )}
                </div>
                <div><p className="font-bold mb-1 text-slate-800">Bankverbindung</p><p>{sender.bankName || '-'}</p><p>IBAN: {sender.iban || '-'}</p><p>BIC: {sender.bic || '-'}</p></div>
                <div><p className="font-bold mb-1 text-slate-800">Registergericht</p><p>Amtsgericht {sender.registerCourt || '-'}</p><p>HR-Nr: {sender.registerNumber || '-'}</p><p className="mt-1 font-bold">Geschäftsführung:</p><p>{sender.ceoFirstName} {sender.ceoLastName}</p></div>
            </div>
        </div>
      );
  };

  // --- RENDER: Login OR App ---
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md p-8 rounded-2xl shadow-2xl">
          <div className="text-center mb-8"><div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"><FileText className="w-8 h-8 text-blue-600" /></div><h1 className="text-2xl font-bold text-slate-800">ERP FLOW Login</h1></div>
          {authError && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center gap-2"><Shield className="w-4 h-4"/> {authError}</div>}
          <div className="space-y-4">
            <button onClick={handleGoogleLogin} className="w-full bg-white border border-slate-300 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-50 transition flex items-center justify-center gap-2"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="G" /> Mit Google anmelden</button>
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">E-Mail</label><div className="relative"><Mail className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" /><input type="email" required className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={email} onChange={e => setEmail(e.target.value)} /></div></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Passwort</label><div className="relative"><Lock className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" /><input type="password" required className="w-full pl-10 p-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" value={password} onChange={e => setPassword(e.target.value)} /></div></div>
              <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition shadow-lg">{authMode === 'login' ? 'Einloggen' : 'Konto erstellen'}</button>
            </form>
            <p className="text-center text-sm text-slate-500 mt-4">{authMode === 'login' ? 'Noch kein Konto?' : 'Bereits registriert?'} <button onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="text-blue-600 font-bold ml-1 hover:underline">{authMode === 'login' ? 'Jetzt registrieren' : 'Hier anmelden'}</button></p>
          </div>
        </div>
      </div>
    );
  }

  // 2. HIER DEN SUPER-ADMIN CHECK EINFÜGEN
  // Wenn Super Admin eingeloggt ist, aber KEINE Firma gewählt hat -> Dashboard zeigen
  if (userProfile?.role === 'super_admin' && !activeCompanyId) {
    // Wir übergeben 'db', damit das Dashboard darauf zugreifen kann
    return <SuperAdminDashboard db={db} />;
  }

  // --- RENDER: Main App ---
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row font-sans text-slate-800">
      {/* Das ist deine Seitenleiste (Sidebar) */}
      <nav className="w-full md:w-64 bg-slate-900 text-slate-300 p-6 flex flex-col gap-2 shrink-0 overflow-y-auto">
        
        {/* --- NEU: HIER EINFÜGEN START --- */}
        {/* Dieser Block prüft: Bist du Super Admin? Dann zeig den Zurück-Button */}
        {userProfile?.role === 'super_admin' && (
           <button 
             onClick={() => switchCompany(null)} 
             className="mb-6 bg-blue-900 text-blue-200 p-3 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-blue-800 transition"
           >
             <ArrowLeft className="w-4 h-4"/> Zurück zur Kanzlei
           </button>
        )}
        {/* --- NEU: HIER EINFÜGEN ENDE --- */}

        {/* Hier drunter ist dein bestehendes Logo / Titel (das hast du schon) */}
        
        <div className="mb-8"><h1 className="text-white text-2xl font-black flex items-center gap-2"><FileText className="text-blue-500" /> ERP FLOW</h1><p className="text-[10px] uppercase tracking-widest opacity-50">Multi-User Billing</p></div>
        
        <div className="space-y-1">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4 px-3">Übersicht</p>
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'dashboard' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><LayoutDashboard className="w-5 h-5"/> Dashboard</button>
            
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-6 px-3">Verkauf</p>
            <button onClick={() => setActiveTab('invoice-editor')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'invoice-editor' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><ArrowUpRight className="w-5 h-5 text-green-400"/> Neue Rechnung</button>
            <button onClick={() => setActiveTab('invoice-history')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'invoice-history' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><History className="w-5 h-5"/> Rechnungsarchiv</button>
            
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-6 px-3">Einkauf</p>
            <button onClick={() => setActiveTab('expense-editor')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'expense-editor' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><ArrowDownLeft className="w-5 h-5 text-orange-400"/> Neue Einkäufe</button>
            <button onClick={() => setActiveTab('expense-history')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'expense-history' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><History className="w-5 h-5"/> Einkaufsarchiv</button>

            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-6 px-3">Stammdaten</p>
            <button onClick={() => setActiveTab('customers')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'customers' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><User className="w-5 h-5"/> Kunden</button>
            <button onClick={() => setActiveTab('vendors')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'vendors' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><Truck className="w-5 h-5"/> Lieferanten</button>
            <button onClick={() => setActiveTab('items')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'items' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><Package className="w-5 h-5"/> Artikel</button>
            <button onClick={() => setActiveTab('suppliers')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'suppliers' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><Briefcase className="w-5 h-5"/> Eigene Profile</button>
            <button onClick={() => setActiveTab('settings')} className={`w-full flex items-center gap-3 p-3 rounded-lg transition ${activeTab === 'settings' ? 'bg-blue-600 text-white' : 'hover:bg-slate-800'}`}><Settings className="w-5 h-5"/> Einstellungen</button>
        </div>
        
        <div className="mt-auto pt-6 border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center gap-2 text-red-400 hover:text-white transition text-sm w-full p-2 rounded hover:bg-slate-800"><LogOut className="w-4 h-4" /> Abmelden</button>
        </div>
      </nav>

      <main className="flex-1 p-4 md:p-10 overflow-y-auto h-screen scroll-smooth relative">
        {/* VIEW MODAL OVERLAY */}
        {viewInvoice && (
            <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 overflow-y-auto backdrop-blur-sm">
                <div className="relative bg-slate-100 rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto flex flex-col">
                    <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
                        <h3 className="font-bold text-lg">Rechnungsvorschau: {viewInvoice.number}</h3>
                        <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                  // 1. Prefix bestimmen (Rechnung oder Korrektur?)
                                  // WICHTIG: Hier nutzen wir 'viewInvoice' statt 'currentInvoice'!
                                  const prefix = viewInvoice.type === 'credit_note' ? 'Rechnungskorrektur' : 'Rechnung';
                                  
                                  // 2. Dateiname bauen
                                  const fileName = `${prefix}_${viewInvoice.number}.pdf`;
                                  
                                  // 3. PDF generieren
                                  generatePDF('invoice-preview-hidden', fileName);
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 transition-colors"
                            >
                              <Printer className="w-4 h-4" /> PDF / Drucken
                            </button>
                            <button onClick={() => setViewInvoice(null)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-300"><X className="w-4 h-4"/></button>
                        </div>
                    </div>
                    <div className="p-8 bg-slate-500 overflow-auto flex justify-center">
                        <InvoicePaper data={viewInvoice} idPrefix="modal-preview-content" />
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-green-500">
                  <p className="text-slate-500 text-sm font-medium">Einnahmen (Netto)</p>
                  <h3 className="text-3xl font-bold mt-1 text-slate-800">{invoices.reduce((acc, curr) => acc + curr.totals.netto, 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</h3>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-red-500">
                  <p className="text-slate-500 text-sm font-medium">Ausgaben (Netto)</p>
                  <h3 className="text-3xl font-bold mt-1 text-slate-800">{expenses.reduce((acc, curr) => acc + curr.totals.netto, 0).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</h3>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-blue-500">
                  <p className="text-slate-500 text-sm font-medium">Gewinn (Netto)</p>
                  <h3 className="text-3xl font-bold mt-1 text-blue-600">
                      {(invoices.reduce((a,c) => a + c.totals.netto, 0) - expenses.reduce((a,c) => a + c.totals.netto, 0)).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                  </h3>
              </div>
              <div className="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-purple-500">
                  <p className="text-slate-500 text-sm font-medium">Offene Posten</p>
                  <h3 className="text-3xl font-bold mt-1 text-slate-800">{invoices.length}</h3>
              </div>
            </div>
            {!profile && <div className="bg-yellow-50 border border-yellow-200 p-6 rounded-xl flex justify-between items-center"><div><h3 className="font-bold text-yellow-800 mb-1">Profil unvollständig</h3><p className="text-sm text-yellow-700">Bitte richten Sie Ihr Firmenprofil ein.</p></div><button onClick={() => setActiveTab('settings')} className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-yellow-700">Einstellungen</button></div>}
          </div>
        )}

        {/* --- SETTINGS TAB (ÜBERARBEITET MIT UNTER-TABS) --- */}
        {activeTab === 'settings' && (
          <div className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
             
             {/* 1. Header & Tabs */}
             <div className="border-b bg-slate-50 p-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2 text-slate-800">
                        <Settings className="w-6 h-6 text-blue-600"/> Einstellungen
                    </h2>
                </div>
                
                {/* DER TAB SWITCHER */}
                <div className="flex bg-slate-200 p-1 rounded-lg gap-1">
                    <button 
                        onClick={() => setSettingsTab('profile')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition ${settingsTab === 'profile' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Firmenprofil
                    </button>
                    <button 
                        onClick={() => setSettingsTab('config')} 
                        className={`px-4 py-2 rounded-md text-sm font-bold transition ${settingsTab === 'config' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Konfigurationen
                    </button>
                    <button 
                        onClick={() => setSettingsTab('vat')}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition ${settingsTab === 'vat' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        Umsatzsteuersätze (EU)
                    </button>
                </div>
             </div>

             {/* 2. INHALT: TAB "PROFIL" (Dein alter Code) */}
             {settingsTab === 'profile' && (
                 <div className="p-8">
                     <p className="text-slate-500 mb-8">Diese Daten erscheinen als Absender und im Fußbereich Ihrer Rechnungen.</p>
                     
                     {/* 1. LOGO UPLOAD BEREICH */}
                     <div className="mb-8 flex items-center gap-6 p-4 border border-dashed border-slate-300 rounded-xl bg-slate-50">
                        <div className="shrink-0">
                          {profile?.logoUrl ? (
                            <img src={profile.logoUrl} alt="Firmenlogo" className="h-20 w-auto object-contain border bg-white rounded-md" />
                          ) : (
                            <div className="h-20 w-20 bg-slate-200 rounded-md flex items-center justify-center text-slate-400 text-xs text-center p-2">
                              Kein Logo
                            </div>
                          )}
                        </div>
                        <div>
                           <label className="block text-sm font-bold text-slate-700 mb-2">Firmenlogo hochladen</label>
                           <input 
                             type="file" 
                             accept="image/*" 
                             onChange={handleLogoUpload} 
                             className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                           />
                           <p className="text-xs text-slate-400 mt-1">Empfohlen: PNG oder JPG mit transparentem Hintergrund.</p>
                           {profile?.logoUrl && (
                            <button 
                              onClick={handleDeleteLogo}
                              className="mt-3 flex items-center gap-2 text-red-500 hover:text-red-700 text-sm font-bold border border-red-200 bg-red-50 px-3 py-2 rounded hover:bg-red-100 transition"
                            >
                              <Trash2 className="w-4 h-4" /> Logo entfernen
                            </button>
                          )}
                        </div>
                     </div>

                     {/* 2. FORMULARFELDER (ADRESSE, KONTAKT, BANK) */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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

                     <div className="flex justify-end border-t pt-6">
                        <button onClick={() => handleSaveProfile(profile)} className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold shadow-lg hover:bg-green-700 flex items-center gap-2"><Save className="w-5 h-5"/> Profil speichern</button>
                     </div>
                 </div>
             )}

             {/* 4. NEU: INHALT TAB "KONFIGURATIONEN" */}
             {settingsTab === 'config' && (
                 <div className="p-8 animate-in fade-in slide-in-from-right-4">
                     <div className="flex justify-between items-end mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">System-Konfigurationen</h3>
                            <p className="text-sm text-slate-500 mt-1">
                                Verwalten Sie hier Ihre Nummernkreise für Rechnungen und Gutschriften.
                            </p>
                        </div>
                        {/* Speicher-Button im Config Tab */}
                        <button 
                            onClick={() => handleSaveProfile(profile, "Konfigurationen gespeichert!")} 
                            className="bg-green-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-green-700 flex items-center gap-2"
                        >
                            <Save className="w-4 h-4"/> Einstellungen speichern
                        </button>
                     </div>

                     {/* RECHNUNGSNUMMERN BLOCK */}
                     <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl space-y-4 mb-8">
                        <h3 className="font-bold text-slate-700 flex items-center gap-2">
                          <Hash className="w-5 h-5 text-slate-500"/> Rechnungsnummern
                        </h3>
                        <p className="text-xs text-slate-500 mb-4">
                          Hier legen Sie fest, wie Ihre Rechnungsnummern aussehen sollen. Das System zählt automatisch hoch.
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Präfix (Kreis)</label>
                              <input 
                                className="w-full p-2 border rounded font-mono bg-white" 
                                placeholder="RE-2026"
                                value={profile?.invoicePrefix || 'RE-2026'} 
                                onChange={e => setProfile({...profile, invoicePrefix: e.target.value})} 
                              />
                              <p className="text-[10px] text-slate-400 mt-1">z.B. "RE", "2026" oder "MUC-24"</p>
                           </div>

                           <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Nächste laufende Nummer</label>
                              <input 
                                type="number"
                                className="w-full p-2 border rounded font-mono bg-white" 
                                placeholder="1000"
                                value={profile?.nextInvoiceNumber || '1000'} 
                                onChange={e => setProfile({...profile, nextInvoiceNumber: e.target.value})} 
                              />
                              <p className="text-[10px] text-slate-400 mt-1">Zähler erhöht sich automatisch (+1).</p>
                           </div>

                           <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Vorschau</label>
                              <div className="w-full p-2 border bg-white rounded font-mono text-slate-700 font-bold">
                                {profile?.invoicePrefix || 'RE'}-{String(profile?.nextInvoiceNumber || '1000').padStart(4, '0')}
                              </div>
                           </div>
                        </div>

                        {/* TRENNLINIE */}
                        <div className="border-t border-slate-200 my-6"></div>

                        {/* GUTSCHRIFTEN BLOCK */}
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
                          <ArrowDownLeft className="w-5 h-5 text-slate-500"/> Gutschriften / Korrekturen
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Präfix (Gutschrift)</label>
                              <input 
                                className="w-full p-2 border rounded font-mono bg-white" 
                                placeholder="GS-2026"
                                value={profile?.creditNotePrefix || 'GS-2026'} 
                                onChange={e => setProfile({...profile, creditNotePrefix: e.target.value})} 
                              />
                           </div>

                           <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Nächste Nummer</label>
                              <input 
                                type="number"
                                className="w-full p-2 border rounded font-mono bg-white" 
                                placeholder="1000"
                                value={profile?.nextCreditNoteNumber || '1000'} 
                                onChange={e => setProfile({...profile, nextCreditNoteNumber: e.target.value})} 
                              />
                           </div>

                           <div>
                              <label className="block text-xs font-bold text-slate-500 mb-1">Vorschau</label>
                              <div className="w-full p-2 border bg-white rounded font-mono text-slate-700 font-bold">
                                {profile?.creditNotePrefix || 'GS'}-{String(profile?.nextCreditNoteNumber || '1000').padStart(4, '0')}
                              </div>
                           </div>
                        </div>

                        {/* TRENNLINIE */}
                        <div className="border-t border-slate-200 my-6"></div>

                        {/* NEU: PFLICHTFELDER KONFIGURATION (Punkt B) */}
                        <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-4">
                          <CheckCircle className="w-5 h-5 text-slate-500"/> Felder & Pflichtangaben
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                           
                           {/* Konfiguration: Bestellnummer */}
                           <div className="bg-white p-4 rounded border flex flex-col justify-between gap-4">
                              <div className="flex items-center justify-between">
                                  <div>
                                      <span className="font-bold text-sm text-slate-700">Bestellnummer (PO)</span>
                                      <p className="text-xs text-slate-400">Feld im Editor anzeigen</p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <input 
                                        type="checkbox" 
                                        className="accent-blue-600 w-4 h-4"
                                        checked={profile?.showOrderNumber || false} 
                                        onChange={e => setProfile({...profile, showOrderNumber: e.target.checked})} 
                                      />
                                      <span className="text-sm font-bold text-slate-600">Aktiv</span>
                                  </div>
                              </div>
                              
                              {/* Unter-Option: Pflichtfeld (nur wenn aktiv) */}
                              {profile?.showOrderNumber && (
                                   <div className="bg-slate-50 p-2 rounded flex items-center gap-2 text-xs text-slate-600 border border-slate-100">
                                       <ArrowUpRight className="w-4 h-4 text-slate-400" />
                                       <input 
                                            type="checkbox" 
                                            checked={profile?.requireOrderNumber || false}
                                            onChange={e => setProfile({...profile, requireOrderNumber: e.target.checked})}
                                       />
                                       <span>Als <strong>Pflichtfeld</strong> markieren (Speichern ohne Nr. blockieren)</span>
                                   </div>
                               )}
                           </div>

                           {/* Konfiguration: Kundennummer */}
                           <div className="bg-white p-4 rounded border flex items-center justify-between">
                              <div>
                                  <span className="font-bold text-sm text-slate-700">Kundennummer</span>
                                  <p className="text-xs text-slate-400">Auf der Rechnung anzeigen</p>
                              </div>
                              <div className="flex items-center gap-2">
                                  <input 
                                    type="checkbox" 
                                    className="accent-blue-600 w-4 h-4"
                                    checked={profile?.showCustomerNumber || false} 
                                    onChange={e => setProfile({...profile, showCustomerNumber: e.target.checked})} 
                                  />
                                  <span className="text-sm font-bold text-slate-600">Aktiv</span>
                              </div>
                           </div>
                        </div>

                     </div>
                 </div>
             )}

             {/* 3. INHALT: TAB "UMSATZSTEUER" (NEU) */}
             {settingsTab === 'vat' && (
                 <div className="p-8">
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">EU-Umsatzsteuersätze (OSS)</h3>
                            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
                                Diese Tabelle definiert die Steuersätze für den One-Stop-Shop (OSS). 
                                Wenn Sie an Privatkunden im EU-Ausland verkaufen, wird der hier hinterlegte Satz angewendet.
                            </p>
                        </div>
                        <button onClick={handleSaveVatRates} className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow hover:bg-blue-700 flex items-center gap-2">
                            <Save className="w-4 h-4"/> Sätze speichern
                        </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden shadow-sm">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-500 font-bold uppercase text-xs">
                                <tr>
                                    <th className="p-4 w-16">Code</th>
                                    <th className="p-4">Land</th>
                                    <th className="p-4 w-32">Normal (%)</th>
                                    <th className="p-4 w-32">Ermäßigt 1 (%)</th>
                                    <th className="p-4 w-32">Ermäßigt 2 (%)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {vatRates.map((rate, index) => (
                                    <tr key={rate.code} className="hover:bg-slate-50 transition">
                                        <td className="p-4 font-mono font-bold text-slate-400">{rate.code}</td>
                                        <td className="p-4 font-medium text-slate-800">{rate.country}</td>
                                        
                                        {/* Input: Normal */}
                                        <td className="p-4">
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    className="w-full p-2 border rounded font-bold text-center focus:ring-2 focus:ring-blue-500 outline-none"
                                                    value={rate.standard}
                                                    onChange={(e) => {
                                                        const newRates = [...vatRates];
                                                        newRates[index].standard = parseFloat(e.target.value);
                                                        setVatRates(newRates);
                                                    }}
                                                />
                                            </div>
                                        </td>

                                        {/* Input: Ermäßigt 1 */}
                                        <td className="p-4">
                                            <input 
                                                type="number" 
                                                className="w-full p-2 border rounded text-center text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={rate.reduced1}
                                                onChange={(e) => {
                                                    const newRates = [...vatRates];
                                                    newRates[index].reduced1 = parseFloat(e.target.value);
                                                    setVatRates(newRates);
                                                }}
                                            />
                                        </td>

                                        {/* Input: Ermäßigt 2 */}
                                        <td className="p-4">
                                            <input 
                                                type="number" 
                                                className="w-full p-2 border rounded text-center text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={rate.reduced2}
                                                onChange={(e) => {
                                                    const newRates = [...vatRates];
                                                    newRates[index].reduced2 = parseFloat(e.target.value);
                                                    setVatRates(newRates);
                                                }}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 </div>
             )}

          </div>
        )}

        {activeTab === 'customers' && <ModuleManager title="Kundenmanagement" data={customers} collectionName="customers" icon={User} fields={addressFields} />}
        {activeTab === 'vendors' && <ModuleManager title="Lieferantenmanagement (Externe)" data={vendors} collectionName="vendors" icon={Truck} fields={addressFields} />}
        {activeTab === 'suppliers' && <ModuleManager title="Andere Absender / Profile" data={suppliers} collectionName="suppliers" icon={Building} fields={fullProfileFields} />}
        {activeTab === 'items' && <ModuleManager title="Artikelkatalog" data={items} collectionName="items" icon={Package} fields={itemFields} />}

        {/* --- INVOICE EDITOR (RESTORED & UPDATED) --- */}
        {activeTab === 'invoice-editor' && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 pb-20 animate-in fade-in slide-in-from-bottom-4">
             {/* LINKER BEREICH: EINGABEMASKE */}
             <div className="space-y-6">
                
                {/* 1. KOPFDATEN */}
                <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                   <h2 className="text-lg font-bold border-b pb-2 flex items-center gap-2 text-blue-600">
                      <FileText className="w-5 h-5"/> Rechnungsdaten
                   </h2>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Absender Wahl */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Absender</label>
                        <select 
                          className="w-full p-2 border rounded bg-slate-50 font-medium"
                          value={currentInvoice.supplierId}
                          onChange={e => setCurrentInvoice({...currentInvoice, supplierId: e.target.value})}
                        >
                          <option value="main_profile">Mein Hauptprofil (Standard)</option>
                          {suppliers.map(s => <option key={s.id} value={s.id}>{s.company}</option>)}
                        </select>
                      </div>

                      {/* Kunde Wahl (MIT AUTO-ERKENNUNG) */}
                      <div>
                        <label className="text-xs font-bold text-slate-500 block mb-1">Kunde (Empfänger)</label>
                        <select 
                           className={`w-full p-2 border rounded font-bold ${!currentInvoice.customerId ? 'border-red-300 bg-red-50' : 'bg-white'}`} 
                           value={currentInvoice.customerId} 
                           onChange={e => {
                             const cust = customers.find(c => c.id === e.target.value);
                             
                             // --- LOGIK: STEUERZONE AUTOMATISCH ERKENNEN ---
                             let newZone = 'DE';
                             let newOssCountry = '';

                             if (cust) {
                                 // Prüfen, ob das Land in unserer EU-Liste ist
                                 const euCountry = vatRates.find(r => r.country === cust.country);

                                 if (cust.country === 'Deutschland' || !cust.country) {
                                     // Fall A: Inland
                                     newZone = 'DE';
                                 } else if (euCountry) {
                                     // Fall B: EU
                                     if (cust.taxId && cust.taxId.length > 2) {
                                         // Hat Steuer-ID -> B2B -> Reverse Charge
                                         newZone = 'EU_REV';
                                     } else {
                                         // Keine Steuer-ID -> B2B/Privat -> OSS
                                         newZone = 'EU_OSS';
                                         newOssCountry = euCountry.code; // Automatisch das Land setzen!
                                     }
                                 } else {
                                     // Fall C: Drittland
                                     newZone = 'NON_EU';
                                 }
                             }
                             // -----------------------------------------------

                             setCurrentInvoice({
                                 ...currentInvoice, 
                                 customerId: e.target.value, 
                                 countryZone: newZone,
                                 ossCountryCode: newOssCountry
                             });
                           }}
                        >
                           <option value="">-- Kunde wählen --</option>
                           {customers.map(c => <option key={c.id} value={c.id}>{getDisplayName(c)}</option>)}
                        </select>
                        {/* --- LOGIK FÜR SAMMELKUNDEN (MANUELLE ADRESSE) --- */}
                        {(() => {
                            // Prüfen, ob der aktuell gewählte Kunde ein "Sammelkunde" ist
                            const selectedC = customers.find(c => c.id === currentInvoice.customerId);
                            
                            if (selectedC && selectedC.isCollective) {
                                return (
                                    <div className="mt-4 bg-orange-50 p-4 rounded-lg border border-orange-200 animate-in fade-in slide-in-from-top-2">
                                        <h4 className="text-orange-800 text-xs font-bold uppercase mb-2 flex items-center gap-2">
                                            <User className="w-3 h-3"/> Manuelle Anschrift (Laufkundschaft)
                                        </h4>
                                        <div className="grid grid-cols-1 gap-2">
                                            <input 
                                                type="text" 
                                                placeholder="Firma / Name des Kunden"
                                                className="w-full p-2 border rounded text-sm"
                                                value={currentInvoice.manualName || ''}
                                                onChange={e => setCurrentInvoice({...currentInvoice, manualName: e.target.value})}
                                            />
                                            <input 
                                                type="text" 
                                                placeholder="Straße & Hausnummer"
                                                className="w-full p-2 border rounded text-sm"
                                                value={currentInvoice.manualStreet || ''}
                                                onChange={e => setCurrentInvoice({...currentInvoice, manualStreet: e.target.value})}
                                            />
                                            <div className="flex gap-2">
                                                <input 
                                                    type="text" 
                                                    placeholder="PLZ"
                                                    className="w-24 p-2 border rounded text-sm"
                                                    value={currentInvoice.manualZip || ''}
                                                    onChange={e => setCurrentInvoice({...currentInvoice, manualZip: e.target.value})}
                                                />
                                                <input 
                                                    type="text" 
                                                    placeholder="Stadt"
                                                    className="w-full p-2 border rounded text-sm"
                                                    value={currentInvoice.manualCity || ''}
                                                    onChange={e => setCurrentInvoice({...currentInvoice, manualCity: e.target.value})}
                                                />
                                                <input 
                                                    type="text" 
                                                    placeholder="Land (Leer lassen für Deutschland)"
                                                    className="w-full p-2 border rounded text-sm"
                                                    value={currentInvoice.manualCountry || ''}
                                                    onChange={e => setCurrentInvoice({...currentInvoice, manualCountry: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            }
                            return null;
                        })()}
                      </div>

                      {/* --- NEU: KUNDEN-INFOS & BESTELLNUMMER --- */}
                      <div className="grid grid-cols-2 gap-4 mb-4 mt-2">
                          
                          {/* 1. Kundennummer (Nur lesen) */}
                          {profile?.showCustomerNumber && currentInvoice.customerId && (
                              <div className="bg-slate-50 p-2 rounded border border-slate-200">
                                  <span className="block text-[10px] text-slate-400 font-bold uppercase">Kundennummer</span>
                                  <span className="font-mono font-bold text-sm text-slate-700">
                                      {/* Wir suchen den Kunden im Array, um die Nummer zu finden */}
                                      {customers.find(c => c.id === currentInvoice.customerId)?.number || 'Keine Nr.'}
                                  </span>
                              </div>
                          )}

                          {/* 2. Bestellnummer (Eingabe) */}
                          {profile?.showOrderNumber && (
                              <div className={profile?.showCustomerNumber ? '' : 'col-span-2'}> {/* Nimmt volle Breite, wenn Kundennr aus ist */}
                                <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1">
                                    Bestellnummer {profile?.requireOrderNumber && <span className="text-red-500">*</span>}
                                </label>
                                <input 
                                    type="text"
                                    className={`w-full p-1.5 border rounded font-medium text-sm ${
                                        profile?.requireOrderNumber && !currentInvoice.orderNumber ? 'border-red-300 bg-red-50' : 'bg-white'
                                    }`}
                                    placeholder="z.B. PO-12345"
                                    value={currentInvoice.orderNumber || ''}
                                    onChange={e => setCurrentInvoice({...currentInvoice, orderNumber: e.target.value})}
                                />
                              </div>
                          )}
                      </div>

                      {/* INTELLIGENTE STEUER-ZONE */}
                      <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                         
                         {/* 1. Die Zone wählen */}
                         <div>
                             <label className="text-xs font-bold text-slate-500 block mb-1">Steuer-Szenario</label>
                             <select 
                                className="w-full p-2 border rounded bg-white font-medium" 
                                value={currentInvoice.countryZone}
                                onChange={e => {
                                    setCurrentInvoice({
                                        ...currentInvoice, 
                                        countryZone: e.target.value,
                                        ossCountryCode: '' 
                                    });
                                }}
                             >
                                <option value="DE">Deutschland (Inland 19%/7%)</option>
                                <option value="EU_REV">EU Ausland B2B (Reverse Charge)</option>
                                <option value="EU_TRI">EU Dreieck B2B (Reverse Charge)</option> {/* <--- NEU */}
                                <option value="EU_OSS">EU Ausland B2C (OSS / Fernverkauf)</option>
                                <option value="NON_EU">Drittland / Export (Steuerfrei)</option>
                             </select>
                         </div>

                         {/* 2. Nur sichtbar bei OSS: Das Zielland wählen */}
                         {currentInvoice.countryZone === 'EU_OSS' && (
                             <div className="animate-in fade-in slide-in-from-left-4">
                                 <label className="text-xs font-bold text-blue-600 block mb-1 flex items-center gap-1">
                                    <Globe className="w-3 h-3"/> Bestimmungsland (OSS)
                                 </label>
                                 <select 
                                    className="w-full p-2 border border-blue-300 bg-blue-50 rounded font-bold text-blue-800"
                                    value={currentInvoice.ossCountryCode}
                                    onChange={e => setCurrentInvoice({...currentInvoice, ossCountryCode: e.target.value})}
                                 >
                                    <option value="">-- Land wählen --</option>
                                    {vatRates.map(rate => (
                                        <option key={rate.code} value={rate.code}>
                                            {rate.country} ({rate.standard}%)
                                        </option>
                                    ))}
                                 </select>
                             </div>
                         )}
                      </div>
                   </div>

                   {/* --- WIEDER DA: RECHNUNGSDATUM --- */}
                   <div className="mb-4">
                       <label className="text-xs font-bold text-slate-500 block mb-1">Rechnungsdatum</label>
                       <input 
                         type="date" 
                         required
                         className="w-full p-2 border rounded bg-white font-medium text-sm"
                         value={currentInvoice.date} 
                         onChange={e => setCurrentInvoice({...currentInvoice, date: e.target.value})}
                       />
                   </div>

                   {/* --- LEISTUNGSDATUM / ZEITRAUM --- */}
                    <div className="mb-4">
                        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">Leistungszeitpunkt</label>
                        
                        {/* Auswahl: Zeitpunkt vs Zeitraum */}
                        <div className="flex gap-4 mb-2 text-sm">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="serviceDateMode"
                                    checked={currentInvoice.serviceDateMode !== 'period'}
                                    onChange={() => setCurrentInvoice({...currentInvoice, serviceDateMode: 'point'})}
                                />
                                <span>Einmalig (Datum)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input 
                                    type="radio" 
                                    name="serviceDateMode"
                                    checked={currentInvoice.serviceDateMode === 'period'}
                                    onChange={() => setCurrentInvoice({...currentInvoice, serviceDateMode: 'period'})}
                                />
                                <span>Zeitraum (Von - Bis)</span>
                            </label>
                        </div>

                        {/* Eingabefelder */}
                        {currentInvoice.serviceDateMode === 'period' ? (
                            <div className="grid grid-cols-2 gap-2">
                                <input 
                                    type="date" 
                                    className="w-full p-2 border rounded text-sm"
                                    // WICHTIG: Korrekter Variablenname für CSV (serviceDateStart)
                                    value={currentInvoice.serviceDateStart || ''}
                                    onChange={e => setCurrentInvoice({...currentInvoice, serviceDateStart: e.target.value})}
                                />
                                <input 
                                    type="date" 
                                    className="w-full p-2 border rounded text-sm"
                                    value={currentInvoice.serviceDateEnd || ''}
                                    onChange={e => setCurrentInvoice({...currentInvoice, serviceDateEnd: e.target.value})}
                                />
                            </div>
                        ) : (
                            <input 
                                type="date" 
                                className="w-full p-2 border rounded text-sm"
                                // Default: Falls leer, nutze Rechnungsdatum oder Heute
                                value={currentInvoice.serviceDate || currentInvoice.date || new Date().toISOString().slice(0, 10)}
                                onChange={e => setCurrentInvoice({...currentInvoice, serviceDate: e.target.value})}
                            />
                        )}
                    </div>

                    {/* --- A: ZAHLUNGSBEDINGUNGEN --- */}
                    <div className="mb-4">
                        <label className="text-xs font-bold text-slate-500 block mb-1">Zahlungsbedingungen</label>
                        <select 
                          className="w-full p-2 border rounded bg-white font-medium text-sm"
                          value={currentInvoice.paymentTerms || '14_days'}
                          onChange={e => setCurrentInvoice({...currentInvoice, paymentTerms: e.target.value})}
                        >
                          <option value="paid">Bereits bezahlt</option>
                          <option value="14_days">Zahlbar innerhalb von 14 Tagen ohne Abzug</option>
                          <option value="7_days">Zahlbar innerhalb von 7 Tagen ohne Abzug</option>
                          <option value="0_days">Zahlbar sofort ohne Abzug</option>
                          <option value="sepa_7">Abbuchung (Lastschrift) innerhalb von 7 Tagen</option>
                        </select>
                    </div>
                </div>

                {/* 2. NUMMERN & PROZENT BLOCK (Dein neuer Code) */}
                <div className="bg-slate-50 p-4 rounded border border-blue-100">
                  <div className="flex justify-between items-start mb-4">
                      <label className="text-xs font-bold text-slate-500 flex items-center gap-1 mt-1">
                        <Hash className="w-3 h-3"/> Rechnungsnummer & Zahlungsplan
                      </label>
                      
                      <label className={`flex items-center gap-2 text-xs font-bold ${currentInvoice.number ? 'text-slate-400 cursor-not-allowed' : 'text-blue-700 cursor-pointer'}`}>
                        <input 
                          type="checkbox" 
                          checked={currentInvoice.isPartial || false} 
                          disabled={!!currentInvoice.number} 
                          onChange={e => setCurrentInvoice({...currentInvoice, isPartial: e.target.checked})}
                          className="accent-blue-600"
                        />
                        Teil-/Abschlagszahlung
                      </label>
                  </div>

                  <div className="flex items-center gap-4">
                      {/* Nummer */}
                      <div className="text-lg font-mono font-bold text-slate-700 bg-white border px-3 py-2 rounded shadow-sm inline-block min-w-[180px]">
                            {currentInvoice.number ? currentInvoice.number : (
                                currentInvoice.isPartial 
                                  ? `${profile?.invoicePrefix || 'RE'}-${String(profile?.nextInvoiceNumber || '1000').padStart(4, '0')}-01`
                                  : `${profile?.invoicePrefix || 'RE'}-${String(profile?.nextInvoiceNumber || '1000').padStart(4, '0')}`
                            )}
                      </div>

                      {/* Prozent-Feld */}
                      {currentInvoice.isPartial && (
                          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                              <div className="bg-white border rounded flex items-center shadow-sm overflow-hidden">
                                  <input 
                                      type="number" 
                                      min="1" 
                                      max="100"
                                      placeholder="30"
                                      className="w-16 p-2 text-center font-bold outline-none"
                                      value={currentInvoice.partialPercentage || ''}
                                      onChange={e => setCurrentInvoice({...currentInvoice, partialPercentage: parseFloat(e.target.value)})}
                                  />
                                  <span className="bg-slate-100 border-l px-3 py-2 text-slate-500 font-bold">%</span>
                              </div>
                              <span className="text-xs font-bold text-slate-500">fällig vom<br/>Gesamtbetrag</span>
                          </div>
                      )}
                  </div>
                   
                   {currentInvoice.number && (
                      <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3"/> Dies ist eine Folgerechnung. Nummer fixiert.
                      </p>
                  )}
                </div>

                {/* 3. ARTIKEL LISTE */}
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                   <h3 className="font-bold text-slate-700 mb-4">Rechnungsposten</h3>
                   
                   {/* Artikel Schnellwahl */}
                   <div className="mb-6 flex gap-2">
                      <select 
                        className="flex-1 p-2 border rounded bg-slate-50 text-sm"
                        onChange={(e) => {
                           const item = items.find(i => i.id === e.target.value);
                           if(item) {
                             setCurrentInvoice({
                               ...currentInvoice,
                               items: [...currentInvoice.items, { ...item, id: Date.now(), itemId: item.id, quantity: 1, taxRate: 19 }]
                             });
                           }
                           e.target.value = "";
                        }}
                      >
                         <option value="">-- Artikel aus Katalog hinzufügen --</option>
                         {items.map(i => <option key={i.id} value={i.id}>{i.number} - {i.description} ({i.price}€)</option>)}
                      </select>
                   </div>

                   {/* Tabelle */}
                   <div className="space-y-4">
                      {currentInvoice.items.map((item, index) => (
                         <div key={item.id} className="flex gap-2 items-start group">
                            <div className="flex-1 grid grid-cols-12 gap-2">
                               <div className="col-span-6">
                                  <input 
                                    className="w-full p-2 border rounded text-sm font-medium" 
                                    placeholder="Beschreibung" 
                                    value={item.description} 
                                    onChange={e => {
                                       const newItems = [...currentInvoice.items];
                                       newItems[index].description = e.target.value;
                                       setCurrentInvoice({...currentInvoice, items: newItems});
                                    }}
                                  />
                               </div>
                               <div className="col-span-2">
                                  <input 
                                    type="number" 
                                    className="w-full p-2 border rounded text-sm text-center" 
                                    placeholder="Menge" 
                                    value={item.quantity} 
                                    onChange={e => {
                                       const newItems = [...currentInvoice.items];
                                       newItems[index].quantity = parseFloat(e.target.value);
                                       setCurrentInvoice({...currentInvoice, items: newItems});
                                    }}
                                  />
                               </div>
                               <div className="col-span-2">
                                  <input 
                                    type="number" 
                                    className="w-full p-2 border rounded text-sm text-right" 
                                    placeholder="Preis" 
                                    value={item.price} 
                                    onChange={e => {
                                       const newItems = [...currentInvoice.items];
                                       newItems[index].price = parseFloat(e.target.value);
                                       setCurrentInvoice({...currentInvoice, items: newItems});
                                    }}
                                  />
                               </div>
                               <div className="col-span-2">
                                  <select 
                                    className="w-full p-2 border rounded text-sm bg-white"
                                    value={item.taxRate}
                                    onChange={e => {
                                       const newItems = [...currentInvoice.items];
                                       newItems[index].taxRate = parseFloat(e.target.value);
                                       setCurrentInvoice({...currentInvoice, items: newItems});
                                    }}
                                  >
                                    {/* Die Werte bleiben 19/7/0 als "Marker", aber der Text ist jetzt generisch */}
                                    <option value="19">Normaler Satz</option>
                                    <option value="7">Ermäßigt 1</option>
                                    <option value="0">Ermäßigt 2 / Steuerfrei</option>
                                  </select>
                               </div>
                            </div>
                            <button 
                              onClick={() => {
                                const newItems = currentInvoice.items.filter((_, i) => i !== index);
                                setCurrentInvoice({...currentInvoice, items: newItems});
                              }}
                              className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded"
                            >
                               <Trash2 className="w-4 h-4"/>
                            </button>
                         </div>
                      ))}
                   </div>
                   
                   <button 
                     onClick={() => setCurrentInvoice({...currentInvoice, items: [...currentInvoice.items, { id: Date.now(), description: '', quantity: 1, price: 0, taxRate: 19 }]})}
                     className="mt-4 w-full py-2 border-2 border-dashed border-slate-200 text-slate-400 rounded-lg text-sm font-bold hover:border-blue-300 hover:text-blue-500 transition"
                   >
                     + Weiteren Posten hinzufügen
                   </button>
                </div>

                {/* 4. FUßTEXT */}
                <div className="bg-white p-6 rounded-xl shadow-sm border">
                   <h3 className="font-bold text-xs text-slate-400 uppercase mb-2">Fußtext / Anmerkungen</h3>
                   <textarea 
                     className="w-full p-3 border rounded-lg text-sm h-24" 
                     value={currentInvoice.notes} 
                     onChange={e => setCurrentInvoice({...currentInvoice, notes: e.target.value})}
                   />
                </div>

                {/* BUTTONS */}
                <div className="flex gap-4 pt-4">
                   <button 
                     onClick={saveInvoice} 
                     disabled={loading}
                     className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                   >
                     {loading ? 'Speichert...' : <><Save className="w-5 h-5"/> Buchen & Archivieren</>}
                   </button>
                   <button 
                     onClick={() => {
                        // 1. Bestimmen: Rechnung oder Korrektur?
                        const typeText = currentInvoice.type === 'credit_note' ? 'Rechnungskorrektur' : 'Rechnung';
                        
                        // 2. Nummer holen:
                        // Entweder die echte gespeicherte Nummer...
                        let fileNum = currentInvoice.number;
                        
                        // ...oder falls leer (Entwurf), berechnen wir die Vorschau-Nummer (wie im PDF)
                        if (!fileNum) {
                             const prefix = profile?.invoicePrefix || 'RE';
                             const nextNum = String(profile?.nextInvoiceNumber || '1000').padStart(4, '0');
                             fileNum = `${prefix}-${nextNum}`;
                             
                             // Optional: Falls Teilrechnung, hängen wir das Suffix an (falls du das nutzt)
                             if (currentInvoice.isPartial) {
                                 fileNum += '-01'; 
                             }
                        }
                        
                        // 3. PDF generieren mit korrektem Namen (z.B. "Rechnung_RE-1005.pdf")
                        generatePDF('invoice-preview-hidden', `${typeText}_${fileNum}.pdf`);
                     }} 
                     className="px-6 bg-orange-600 text-white rounded-xl font-bold shadow-lg hover:bg-orange-700 flex items-center gap-2"
                   >
                     <Printer className="w-5 h-5"/> Drucken / PDF
                   </button>
                </div>

             </div>

             {/* RECHTE SPALTE: LIVE VORSCHAU (MIT DYNAMISCHER BREITE) */}
             {/* 1. Wir geben dem Container die 'ref', damit wir seine Breite messen können */}
             <div 
                ref={previewContainerRef}
                className="bg-slate-50 border-l border-slate-200 p-4 lg:p-8 overflow-y-auto custom-scrollbar h-[calc(100vh-4rem)] lg:sticky lg:top-0 flex flex-col items-center"
             >
                
                <h3 className="font-bold text-slate-400 uppercase tracking-wider text-xs mb-4 w-full flex justify-between items-center">
                    <span>Vorschau</span>
                    <span className="text-[10px] bg-slate-200 px-2 py-1 rounded text-slate-500">A4 Format</span>
                </h3>

                {/* 2. ZOOM-CONTAINER
                   Hier haben wir die festen Klassen (scale-[...]) ENTFERNT.
                   Stattdessen nutzen wir style={{ transform: ... }} mit unserem berechneten Wert.
                */}
                <div 
                    className="origin-top transition-transform duration-100 mb-10"
                    style={{ transform: `scale(${previewScale})` }}
                >
                    <div 
                        className="bg-white shadow-2xl min-h-[297mm] text-slate-800 relative" 
                        style={{ width: '210mm' }}
                        id="invoice-preview"
                    >
                         {/* --- LIVE VORSCHAU INHALT (Unverändert) --- */}
                         {(() => {
                                let previewNumber = '';
                                if (currentInvoice.number) {
                                    previewNumber = currentInvoice.number;
                                } else {
                                    const prefix = profile?.invoicePrefix || 'RE';
                                    const nextNum = String(profile?.nextInvoiceNumber || '1000').padStart(4, '0');
                                    if (currentInvoice.isPartial) {
                                        previewNumber = `${prefix}-${nextNum}-01`;
                                    } else {
                                        previewNumber = `${prefix}-${nextNum}`;
                                    }
                                }

                                return (
                                    <InvoicePaper 
                                        data={{
                                            ...currentInvoice, 
                                            number: previewNumber, 
                                            totals: totals,
                                            customerSnap: customers.find(c => c.id === currentInvoice.customerId),
                                            isPartial: currentInvoice.isPartial,
                                            partialPercentage: currentInvoice.partialPercentage
                                        }} 
                                        idPrefix="invoice-preview-live" 
                                    />
                                );
                            })()}
                    </div>
                </div>

             </div>
          </div>
        )}

        {/* --- INVOICE HISTORY (MIT FILTER & SORTIERUNG) --- */}
        {activeTab === 'invoice-history' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
             
             {/* 1. HEADER & FILTER */}
             <div className="p-6 border-b border-slate-100 space-y-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <History className="w-5 h-5 text-slate-500"/> Rechnungsarchiv
                        </h2>
                        <div className="text-xs text-slate-500 mt-1">
                            {processedInvoices.length} Rechnungen gefunden
                        </div>
                    </div>
                    {selectedInvoices.length > 0 && (
                        <div className="flex gap-2 items-center bg-blue-50 p-2 rounded-lg border border-blue-100 animate-in fade-in">
                            <span className="text-sm font-bold text-blue-800 px-2">{selectedInvoices.length} ausgewählt</span>
                            <button onClick={downloadInvoicesCSV} className="text-blue-700 hover:bg-blue-100 px-3 py-1 rounded text-xs flex items-center gap-1"><FileText className="w-3 h-3"/> CSV Export</button>
                        </div>
                    )}
                </div>

                {/* FILTER FELDER */}
                <div className="flex gap-4 items-end bg-slate-50 p-4 rounded-lg border border-slate-100">
                    <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Nach Kunde filtern</label>
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                            <input 
                                type="text" 
                                placeholder="Kundenname..." 
                                className="w-full pl-9 pr-4 py-2 border rounded text-sm focus:outline-none focus:border-blue-500"
                                value={filterCustomer}
                                onChange={e => setFilterCustomer(e.target.value)}
                            />
                        </div>
                    </div>
                    {/* NEU: ZEITRAUM FILTER */}
                    <div className="flex gap-2 items-end">
                        <div className="w-32">
                            <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Von</label>
                            <input 
                                type="date" 
                                className="w-full px-2 py-2 border rounded text-sm focus:outline-none focus:border-blue-500"
                                value={filterDateStart}
                                onChange={e => setFilterDateStart(e.target.value)}
                            />
                        </div>
                        <div className="w-32">
                            <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Bis</label>
                            <input 
                                type="date" 
                                className="w-full px-2 py-2 border rounded text-sm focus:outline-none focus:border-blue-500"
                                value={filterDateEnd}
                                onChange={e => setFilterDateEnd(e.target.value)}
                            />
                        </div>
                    </div>
                    {/* RESET BUTTON (KORRIGIERT) */}
                    {(filterCustomer || filterDateStart || filterDateEnd) && (
                        <button 
                            onClick={() => { 
                                setFilterCustomer(''); 
                                setFilterDateStart(''); 
                                setFilterDateEnd(''); 
                            }}
                            className="px-3 py-2 text-red-500 hover:bg-red-50 rounded text-sm font-bold flex items-center gap-1 h-[38px]"
                        >
                            <X className="w-4 h-4" /> Reset
                        </button>
                    )}
                </div>
             </div>

             {/* 2. TABELLE (KLICKBAR) */}
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold cursor-pointer select-none border-b">
                    <tr>
                        <th className="p-4 w-10 cursor-default">
                            <button onClick={() => setSelectedInvoices(selectedInvoices.length === processedInvoices.length ? [] : processedInvoices.map(i => i.id))}>
                                {selectedInvoices.length === processedInvoices.length && processedInvoices.length > 0 ? <CheckSquare className="w-4 h-4 text-blue-600"/> : <Square className="w-4 h-4"/>}
                            </button>
                        </th>
                        
                        <th className="p-4 hover:text-blue-600 group" onClick={() => requestSort('number')}>
                            <div className="flex items-center gap-1">Nr. {sortConfig.key === 'number' && (sortConfig.direction === 'asc' ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownLeft className="w-3 h-3"/>)}</div>
                        </th>
                        
                        <th className="p-4 hover:text-blue-600 group" onClick={() => requestSort('date')}>
                            <div className="flex items-center gap-1">Datum {sortConfig.key === 'date' && (sortConfig.direction === 'asc' ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownLeft className="w-3 h-3"/>)}</div>
                        </th>

                        <th className="p-4 hover:text-blue-600 group" onClick={() => requestSort('customer')}>
                            <div className="flex items-center gap-1">Kunde {sortConfig.key === 'customer' && (sortConfig.direction === 'asc' ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownLeft className="w-3 h-3"/>)}</div>
                        </th>

                        <th className="p-4 text-right hover:text-blue-600 group" onClick={() => requestSort('netto')}>
                            <div className="flex items-center justify-end gap-1">Netto {sortConfig.key === 'netto' && (sortConfig.direction === 'asc' ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownLeft className="w-3 h-3"/>)}</div>
                        </th>

                        <th className="p-4 text-right hover:text-blue-600 group" onClick={() => requestSort('tax')}>
                            <div className="flex items-center justify-end gap-1">MwSt. {sortConfig.key === 'tax' && (sortConfig.direction === 'asc' ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownLeft className="w-3 h-3"/>)}</div>
                        </th>

                        <th className="p-4 text-right hover:text-blue-600 group" onClick={() => requestSort('brutto')}>
                            <div className="flex items-center justify-end gap-1">Brutto {sortConfig.key === 'brutto' && (sortConfig.direction === 'asc' ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownLeft className="w-3 h-3"/>)}</div>
                        </th>
                        
                        <th className="p-4 text-center hover:text-blue-600 group" onClick={() => requestSort('partial')}>
                            <div className="flex items-center justify-center gap-1">Abschlag {sortConfig.key === 'partial' && (sortConfig.direction === 'asc' ? <ArrowUpRight className="w-3 h-3"/> : <ArrowDownLeft className="w-3 h-3"/>)}</div>
                        </th>

                        <th className="p-4 text-right cursor-default">Aktion</th>
                    </tr>
                </thead>
                <tbody className="divide-y">
                    {processedInvoices.map(inv => (
                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4">
                                <button onClick={() => setSelectedInvoices(prev => prev.includes(inv.id) ? prev.filter(id => id !== inv.id) : [...prev, inv.id])}>
                                    {selectedInvoices.includes(inv.id) ? <CheckSquare className="w-4 h-4 text-blue-600"/> : <Square className="w-4 h-4 text-slate-300"/>}
                                </button>
                            </td>

                            <td className="p-4 font-bold text-slate-700 whitespace-nowrap">
                                {inv.number}
                                {inv.type === 'credit_note' && <span className="ml-2 text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded uppercase">GS</span>}
                            </td>
                            
                            <td className="p-4 text-sm text-slate-600 whitespace-nowrap">
                                {new Date(inv.date).toLocaleDateString('de-DE')}
                            </td>

                            <td className="p-4 text-sm font-medium text-slate-800">
                                {getDisplayName(inv.customerSnap)}
                            </td>

                            <td className="p-4 text-right text-slate-500 text-sm whitespace-nowrap">
                                {inv.totals.netto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </td>

                            <td className="p-4 text-right text-slate-400 text-xs whitespace-nowrap">
                                {inv.totals.taxTotal.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </td>

                            <td className={`p-4 text-right font-bold text-sm whitespace-nowrap ${inv.totals.brutto < 0 ? 'text-red-600' : 'text-blue-600'}`}>
                                {inv.totals.brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                            </td>

                            <td className="p-4 text-center">
                                {inv.isPartial && inv.partialPercentage ? (
                                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-bold">
                                        {inv.partialPercentage}%
                                    </span>
                                ) : (
                                    <span className="text-slate-300">-</span>
                                )}
                            </td>

                            <td className="p-4 text-right flex justify-end gap-2">
                                {inv.number && inv.number.match(/-\d{2}$/) && (
                                    <button 
                                      onClick={() => handleNextPartial(inv)} 
                                      title="Nächste Abschlagsrechnung" 
                                      className="text-green-600 hover:bg-green-50 p-2 rounded"
                                    >
                                      <ArrowUpRight className="w-4 h-4"/>
                                    </button>
                                )}
                                <button onClick={() => setViewInvoice(inv)} title="Ansehen" className="text-blue-500 hover:bg-blue-50 p-2 rounded"><Eye className="w-4 h-4"/></button>
                                <button onClick={() => handleStorno(inv)} title="Stornieren" className="text-orange-400 hover:bg-orange-50 p-2 rounded"><Ban className="w-4 h-4"/></button>
                                <button onClick={() => handleDelete('invoices', inv.id)} className="text-red-400 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4"/></button>
                            </td>
                        </tr>
                    ))}
                    {processedInvoices.length === 0 && (
                        <tr><td colSpan="9" className="p-8 text-center text-slate-400 italic">Keine Rechnungen für diese Filter gefunden.</td></tr>
                    )}
                </tbody>
             </table>
          </div>
        )}

        {/* --- EXPENSE EDITOR (INCOMING) --- */}
        {activeTab === 'expense-editor' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-20">
             <div className="space-y-6">
                <div className="bg-white p-6 rounded-xl shadow-sm border space-y-4">
                   <h2 className="text-lg font-bold border-b pb-2 flex items-center gap-2 text-orange-600"><ArrowDownLeft className="w-5 h-5"/> Neue Einkäufe erfassen</h2>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div><label className="text-xs font-bold text-slate-400">Lieferant *</label><select className="w-full p-2 border rounded bg-white" value={currentExpense.vendorId} onChange={e => setCurrentExpense({...currentExpense, vendorId: e.target.value})}><option value="">-- Wählen --</option>{vendors.map(v => <option key={v.id} value={v.id}>{getDisplayName(v)}</option>)}</select></div>
                      <div><label className="text-xs font-bold text-slate-400">Externe Beleg-Nr.</label><input className="w-full p-2 border rounded" placeholder="RE-12345" value={currentExpense.number} onChange={e => setCurrentExpense({...currentExpense, number: e.target.value})}/></div>
                      <div><label className="text-xs font-bold text-slate-400">Belegdatum</label><input type="date" className="w-full p-2 border rounded" value={currentExpense.date} onChange={e => setCurrentExpense({...currentExpense, date: e.target.value})}/></div>
                      <div><label className="text-xs font-bold text-slate-400">Kategorie</label><select className="w-full p-2 border rounded bg-white" value={currentExpense.category} onChange={e => setCurrentExpense({...currentExpense, category: e.target.value})}><option>Wareneinkauf</option><option>Büromaterial</option><option>Miete</option><option>Werbung</option><option>KFZ</option><option>Sonstiges</option></select></div>
                   </div>
                   <div><label className="text-xs font-bold text-slate-400">Beschreibung</label><input className="w-full p-2 border rounded" placeholder="Wofür war diese Ausgabe?" value={currentExpense.description} onChange={e => setCurrentExpense({...currentExpense, description: e.target.value})}/></div>
                   <div className="grid grid-cols-3 gap-4 bg-orange-50 p-4 rounded-lg border border-orange-100">
                      <div><label className="text-xs font-bold text-slate-500">Netto Betrag (€)</label><input type="number" className="w-full p-2 border rounded" value={currentExpense.netto} onChange={e => setCurrentExpense({...currentExpense, netto: parseFloat(e.target.value) || 0})}/></div>
                      <div><label className="text-xs font-bold text-slate-500">MwSt Satz (%)</label><select className="w-full p-2 border rounded" value={currentExpense.taxRate} onChange={e => setCurrentExpense({...currentExpense, taxRate: parseFloat(e.target.value)})}> <option value="19">19%</option><option value="7">7%</option><option value="0">0%</option></select></div>
                      <div><label className="text-xs font-bold text-slate-500">Brutto (Auto)</label><div className="w-full p-2 font-bold text-slate-700">{(expenseTotals.brutto).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</div></div>
                   </div>
                   <button onClick={saveExpense} disabled={loading} className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold shadow-md hover:bg-orange-700 transition flex items-center justify-center gap-2"><Save className="w-5 h-5"/> Ausgabe buchen</button>
                </div>
             </div>
             {/* Expense Preview List - just recent ones */}
             <div className="bg-white rounded-xl shadow-sm border p-6">
                <h3 className="font-bold text-slate-500 mb-4">Letzte Ausgaben</h3>
                {expenses.slice(0, 5).map(ex => (
                   <div key={ex.id} className="flex justify-between items-center py-3 border-b last:border-0">
                      <div><p className="font-bold text-sm">{ex.vendorSnap?.company || 'Unbekannt'}</p><p className="text-xs text-slate-400">{ex.description}</p></div>
                      <div className="text-right"><p className="font-bold text-red-600">-{ex.totals.brutto.toLocaleString('de-DE', {style:'currency', currency:'EUR'})}</p><p className="text-xs text-slate-400">{ex.date}</p></div>
                   </div>
                ))}
             </div>
          </div>
        )}

        {/* --- EXPENSE HISTORY (INCOMING) --- */}
        {activeTab === 'expense-history' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
             <div className="p-6 border-b bg-slate-50 flex justify-between items-center">
                <div><h2 className="text-xl font-bold">Einkaufsarchiv</h2><div className="text-xs text-slate-500">Archiv Ihrer Ausgaben</div></div>
             </div>
             <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold">
                    <tr><th className="p-4">Datum</th><th className="p-4">Lieferant</th><th className="p-4">Beschreibung</th><th className="p-4">Netto</th><th className="p-4">Brutto</th><th className="p-4 text-right">Aktion</th></tr>
                </thead>
                <tbody className="divide-y">
                    {expenses.sort((a,b) => new Date(b.date) - new Date(a.date)).map(ex => (
                        <tr key={ex.id} className="hover:bg-slate-50">
                            <td className="p-4 text-slate-500 text-sm">{ex.date}</td>
                            <td className="p-4 font-bold">{getDisplayName(ex.vendorSnap)}<div className="text-[10px] text-slate-400 font-normal">{ex.number}</div></td>
                            <td className="p-4 text-sm">{ex.description}<div className="text-[10px] bg-slate-100 inline-block px-1 rounded text-slate-500">{ex.category}</div></td>
                            <td className="p-4 text-slate-500">{ex.totals.netto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                            <td className="p-4 font-bold text-red-600">-{ex.totals.brutto.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
                            <td className="p-4 text-right">
                                <button onClick={() => handleDelete('expenses', ex.id)} className="text-red-400 hover:bg-red-50 p-2 rounded"><Trash2 className="w-4 h-4"/></button>
                            </td>
                        </tr>
                    ))}
                </tbody>
             </table>
          </div>
        )}

      </main>
      {/* ================================================================================== */}
      {/* VERSTECKTER BEREICH FÜR PDF-GENERIERUNG (KORRIGIERT & DATEN-ANGEREICHERT)          */}
      {/* 1. Position fixed & left -5000px sorgt dafür, dass es unsichtbar aber renderbar ist */}
      {/* 2. Wir reichern 'currentInvoice' mit customerSnap und totals an, damit PDF voll ist */}
      {/* ================================================================================== */}
      <div style={{ position: 'fixed', top: 0, left: '-5000px', width: '210mm' }}>
        {(() => {
            // Logik: Wenn wir eine Archiv-Rechnung ansehen (viewInvoice), nehmen wir die.
            // Wenn nicht, bauen wir uns die aktuellen Editor-Daten zusammen.
            let pdfData = viewInvoice;
            
            if (!pdfData) {
                // Editor-Modus: Wir müssen die Daten "live" zusammenbauen
                const prefix = profile?.invoicePrefix || 'RE';
                const nextNum = String(profile?.nextInvoiceNumber || '1000').padStart(4, '0');
                let tempNumber = currentInvoice.number;
                
                // Falls noch keine Nummer fixiert ist, generieren wir die Vorschau-Nummer
                if (!tempNumber) {
                     tempNumber = currentInvoice.isPartial 
                        ? `${prefix}-${nextNum}-01`
                        : `${prefix}-${nextNum}`;
                }

                pdfData = {
                    ...currentInvoice,
                    // WICHTIG: Hier holen wir die echten Kundendaten aus der ID
                    customerSnap: customers.find(c => c.id === currentInvoice.customerId),
                    // WICHTIG: Hier übergeben wir die berechneten Summen (totals ist global im State)
                    totals: totals,
                    // Die Nummer setzen
                    number: tempNumber
                };
            }

            return (
                <InvoicePaper 
                    data={pdfData} 
                    idPrefix="invoice-preview-hidden" 
                />
            );
        })()}
      </div>

      {/* Ende des Main Containers */}
    </div>
  );
}

// --- Das hier ist der neue Einstiegspunkt deiner App ---
export default function App() {
  return (
    <AuthProvider auth={auth} db={db}>
      <ErpSystem />
    </AuthProvider>
  );
}