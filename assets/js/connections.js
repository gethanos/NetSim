/**
 * MIT License
 * 
 * Copyright (c) 2025 Georgalas Athanasios-Antonios (Thanos), CITEd.gr VLE
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { areInSameNetwork, getNetworkAddress } from './network-core.js';
// Διαχείριση συνδέσεων - ΠΛΗΡΩΣ ΔΙΟΡΘΩΜΕΝΗ ΜΕ INTERNET ACCESS
class ConnectionManager {
    constructor() {
        this.connections = [];
        this.packets = [];
        this.isSimulating = false;
        this.packetInterval = null;
    }
    
    // ==================== ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ====================
    
    // Λήψη IP συσκευής (λειτουργεί και για routers)
    getDeviceIP(device) {
        if (!device) return null;
        if (device.type === 'router') {
            return device.interfaces?.lan?.ip || device.interfaces?.wan?.ip;
        }
        return device.ip;
    }
    
    // Λήψη μάσκας υποδικτύου συσκευής
    getDeviceSubnet(device) {
        if (!device) return '255.255.255.0';
        if (device.type === 'router') {
            return device.interfaces?.lan?.subnetMask || device.interfaces?.wan?.subnetMask || '255.255.255.0';
        }
        return device.subnetMask || '255.255.255.0';
    }
    
    // Λήψη gateway συσκευής
    getDeviceGateway(device) {
        if (!device) return null;
        if (device.type === 'router') {
            return device.interfaces?.wan?.gateway;
        }
        return device.gateway;
    }
    
    // Λήψη DNS συσκευής
    getDeviceDNS(device) {
        if (!device) return [];
        if (device.type === 'router') {
            return device.interfaces?.lan?.dns || device.interfaces?.wan?.dns || [];
        }
        return device.dns || [];
    }
    
    // Έλεγχος αν το IP είναι εξωτερικό (Internet)
    isExternalIP(ip) {
        if (!ip || ip === 'N/A') return false;
        
        // Εσωτερικές IP ranges (όχι σε αυτά τα ranges = εξωτερικό)
        const privateRanges = [
            /^10\./,                        // 10.0.0.0/8
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
            /^192\.168\./,                  // 192.168.0.0/16
            /^127\./,                       // Loopback
            /^169\.254\./,                  // Link-local
            /^203\.0\.113\./                // TEST-NET-3
        ];
        
        // Αν δεν είναι εσωτερικό, είναι εξωτερικό
        const isPrivate = privateRanges.some(regex => regex.test(ip));
        return !isPrivate;
    }
    
    // Έλεγχος αν ο router έχει πρόσβαση στο Internet
    routerHasInternetAccess(router) {
        if (!router || router.type !== 'router') return false;
        
        const wanIP = router.interfaces?.wan?.ip;
        const wanGateway = router.interfaces?.wan?.gateway;
        
        return wanIP && wanIP !== 'N/A' && wanIP !== '0.0.0.0' &&
               wanGateway && wanGateway !== '0.0.0.0' && wanGateway !== 'N/A';
    }
    
    // ==================== ΝΕΕΣ ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ΓΙΑ ROUTERS ====================
    
    // Προσδιορισμός interface για σύνδεση router
    getInterfaceForRouterConnection(router, otherRouter) {
        console.log(`[ROUTER INTERFACE] Προσδιορισμός interface για ${router.name} ↔ ${otherRouter.name}`);
        
        // 1. Έλεγχος αν υπάρχει ήδη πληροφορία στο connectionInterfaces
        if (router.connectionInterfaces) {
            for (const [connId, interfaceType] of Object.entries(router.connectionInterfaces)) {
                const conn = this.connections.find(c => c.id === connId);
                if (conn) {
                    const otherId = conn.device1Id === router.id ? conn.device2Id : conn.device1Id;
                    if (otherId === otherRouter.id) {
                        console.log(`[ROUTER INTERFACE] Βρέθηκε υπάρχουσα: ${interfaceType}`);
                        return interfaceType;
                    }
                }
            }
        }
        
        // 2. Προσπάθεια να μαντέψουμε από τα IP
        const routerLanIP = router.interfaces.lan.ip;
        const otherLanIP = otherRouter.interfaces.lan.ip;
        const routerWanIP = router.interfaces.wan.ip;
        const otherWanIP = otherRouter.interfaces.wan.ip;
        
        // Αν ο ένας έχει WAN IP στο δίκτυο του άλλου LAN
        if (routerWanIP && routerWanIP !== 'N/A' && routerWanIP !== '0.0.0.0') {
            if (otherLanIP && otherLanIP !== 'N/A') {
                const wanNetwork = this.getNetworkFromIP(routerWanIP, router.interfaces.wan.subnetMask);
                const lanNetwork = this.getNetworkFromIP(otherLanIP, otherRouter.interfaces.lan.subnetMask);
                
                if (wanNetwork === lanNetwork) {
                    console.log(`[ROUTER INTERFACE] Router WAN είναι στο LAN του άλλου → WAN interface`);
                    return 'wan';
                }
            }
        }
        
        if (otherWanIP && otherWanIP !== 'N/A' && otherWanIP !== '0.0.0.0') {
            if (routerLanIP && routerLanIP !== 'N/A') {
                const wanNetwork = this.getNetworkFromIP(otherWanIP, otherRouter.interfaces.wan.subnetMask);
                const lanNetwork = this.getNetworkFromIP(routerLanIP, router.interfaces.lan.subnetMask);
                
                if (wanNetwork === lanNetwork) {
                    console.log(`[ROUTER INTERFACE] Άλλος router WAN είναι στο LAN μας → LAN interface`);
                    return 'lan';
                }
            }
        }
        
        // 3. Default: LAN interface (συνήθης περίπτωση για πρώτη σύνδεση)
        console.log(`[ROUTER INTERFACE] Default: LAN interface`);
        return 'lan';
    }
    
    // Ανάθεση WAN IP σε router όταν συνδέεται ως WAN
    assignRouterWanIP(router, otherRouter) {
        console.log(`[ROUTER WAN IP] Ανάθεση WAN IP για ${router.name} που συνδέεται με ${otherRouter.name}`);
        
        // Αν ο router έχει ήδη WAN IP, τη διατηρούμε
        if (router.interfaces.wan.ip && router.interfaces.wan.ip !== 'N/A' && router.interfaces.wan.ip !== '0.0.0.0') {
            console.log(`[ROUTER WAN IP] Έχει ήδη WAN IP: ${router.interfaces.wan.ip}`);
            return router.interfaces.wan.ip;
        }
        
        // Αν ο άλλος router έχει LAN IP, δημιουργούμε WAN IP στο ίδιο δίκτυο
        const otherLanIP = otherRouter.interfaces.lan.ip;
        if (otherLanIP && otherLanIP !== 'N/A' && otherLanIP !== '0.0.0.0') {
            const ipParts = otherLanIP.split('.');
            
            // Προσπάθεια να βρούμε ελεύθερο IP (2-254)
            for (let i = 2; i < 255; i++) {
                ipParts[3] = i.toString();
                const potentialIP = ipParts.join('.');
                
                // Έλεγχος αν το IP είναι διαθέσιμο
                const existingDevice = window.deviceManager?.getDeviceByIP(potentialIP);
                if (!existingDevice || existingDevice.id === router.id) {
                    router.interfaces.wan.ip = potentialIP;
                    router.interfaces.wan.subnetMask = otherRouter.interfaces.lan.subnetMask || '255.255.255.0';
                    router.interfaces.wan.gateway = otherLanIP;
                    
                    console.log(`[ROUTER WAN IP] Ορίστηκε WAN IP: ${potentialIP}, Gateway: ${otherLanIP}`);
                    
                    // Ενημέρωση εμφάνισης
                    if (router.element && router.element.querySelector('.device-ip')) {
                        router.element.querySelector('.device-ip').innerHTML = 
                            `WAN: ${potentialIP}<br>LAN: ${router.interfaces.lan.ip}`;
                    }
                    
                    return potentialIP;
                }
            }
        }
        
        // Fallback: Χρήση σταθερού IP
        router.interfaces.wan.ip = '192.168.1.6';
        router.interfaces.wan.subnetMask = '255.255.255.0';
        router.interfaces.wan.gateway = '192.168.1.1';
        
        console.log(`[ROUTER WAN IP] Fallback WAN IP: 192.168.1.6`);
        return '192.168.1.6';
    }
    
    // ==================== ΒΑΣΙΚΗ ΜΕΘΟΔΟΣ ΔΗΜΙΟΥΡΓΙΑΣ ΣΥΝΔΕΣΗΣ ====================

    // Βασική μέθοδος δημιουργίας σύνδεσης (χωρίς router-to-router λογική)
    createBasicConnection(device1, device2) {
        console.log(`[BASIC CONNECTION] Δημιουργία: ${device1.name} ↔ ${device2.name}`);
        
        // Έλεγχος αν μπορούν να δεχτούν σύνδεση
        const can1 = this.canAcceptConnection(device1);
        const can2 = this.canAcceptConnection(device2);
        
        if (!can1 || !can2) {
            console.log(`[BASIC CONNECTION] Απορρίφθηκε: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`);
            
            if (window.uiManager) {
                window.uiManager.addLog(`Σφάλμα: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`, "error");
            }
            
            return null;
        }
        
        // Έλεγχος αν υπάρχει ήδη η σύνδεση
        const existingConnection = this.connections.find(conn => 
            (conn.device1Id === device1.id && conn.device2Id === device2.id) ||
            (conn.device1Id === device2.id && conn.device2Id === device1.id)
        );
        
        if (existingConnection) {
            console.log(`[BASIC CONNECTION] Οι συσκευές είναι ήδη συνδεδεμένες`);
            
            if (window.uiManager) {
                window.uiManager.addLog(`Οι συσκευές είναι ήδη συνδεδεμένες`, "warning");
            }
            
            return existingConnection;
        }
        
        // Δημιουργία νέας σύνδεσης
        const connection = {
            id: 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            device1Id: device1.id,
            device2Id: device2.id,
            type: 'direct', // direct, routed, etc.
            canCommunicate: true,
            timestamp: new Date().toISOString()
        };
        
        // Προσθήκη στις λίστες
        this.connections.push(connection);
        
        // Ενημέρωση των συσκευών
        if (!device1.connections) device1.connections = [];
        if (!device2.connections) device2.connections = [];
        
        device1.connections.push(connection.id);
        device2.connections.push(connection.id);
        
        // Έλεγχος επικοινωνίας
        const communication = this.canDevicesCommunicateDirectly(device1, device2);
        connection.canCommunicate = communication.canCommunicate;
        connection.type = communication.viaGateway ? 'routed' : 'direct';
        
        console.log(`[BASIC CONNECTION] Δημιουργήθηκε: ${device1.name} ↔ ${device2.name} (${connection.canCommunicate ? 'ΕΠΙΚΟΙΝΩΝΙΑ ΔΥΝΑΤΗ' : 'ΧΩΡΙΣ ΕΠΙΚΟΙΝΩΝΙΑ'})`);
        
        // Ενημέρωση UI
        if (window.uiManager) {
            window.uiManager.addLog(`Δημιουργήθηκε σύνδεση: ${device1.name} ↔ ${device2.name}`, 'success');
            this.updateConnectionsVisual();
        }
        
        return connection;
    }

    // Έλεγχος συμβατότητας router interfaces
    canRoutersConnect(router1, router2, interface1, interface2) {
        console.log(`[ROUTER CONNECTION] Έλεγχος: ${router1.name} (${interface1}) ↔ ${router2.name} (${interface2})`);
        
        // ΕΛΕΓΧΟΣ 1: LAN ↔ WAN - ΑΥΤΟ ΕΙΝΑΙ ΠΑΝΤΑ ΕΠΙΤΡΕΠΟΜΕΝΟ!
        if ((interface1 === 'lan' && interface2 === 'wan') || 
            (interface1 === 'wan' && interface2 === 'lan')) {
            console.log(`[ROUTER CONNECTION] LAN ↔ WAN σύνδεση - ΑΠΟΔΕΚΤΗ ΑΜΕΣΑ`);
            return true;  // ΕΠΙΤΡΕΠΕΤΑΙ ΧΩΡΙΣ ΠΕΡΑΙΤΕΡΟΥΣ ΕΛΕΓΧΟΥΣ!
        }
        
        // ΕΛΕΓΧΟΣ 2: WAN ↔ WAN
        if (interface1 === 'wan' && interface2 === 'wan') {
            console.log(`[ROUTER CONNECTION] WAN ↔ WAN - ΕΛΕΓΧΟΣ IP`);
            
            const ip1 = router1.interfaces.wan.ip;
            const ip2 = router2.interfaces.wan.ip;
            const mask1 = router1.interfaces.wan.subnetMask;
            const mask2 = router2.interfaces.wan.subnetMask;
            
            console.log(`[ROUTER CONNECTION] IP1: ${ip1}, IP2: ${ip2}`);
            
            // Έλεγχος για έγκυρα IP
            if (!ip1 || ip1 === 'N/A' || ip1 === '0.0.0.0' ||
                !ip2 || ip2 === 'N/A' || ip2 === '0.0.0.0') {
                console.log(`[ROUTER CONNECTION] WAN ↔ WAN - Λείπουν IP`);
                return false;
            }
            
            // Έλεγχος αν είναι ίδιο IP
            if (ip1 === ip2) {
                console.log(`[ROUTER CONNECTION] WAN ↔ WAN - Ίδια IP`);
                return false;
            }
            
            // ΕΛΕΓΧΟΣ ΓΙΑ ΙΔΙΟ ΔΙΚΤΥΟ (ΜΟΝΟ ΓΙΑ WAN ↔ WAN)
            const network1 = this.getNetworkFromIP(ip1, mask1);
            const network2 = this.getNetworkFromIP(ip2, mask2);
            
            console.log(`[ROUTER CONNECTION] Network1: ${network1}, Network2: ${network2}`);
            
            if (network1 !== network2) {
                console.log(`[ROUTER CONNECTION] WAN ↔ WAN - Διαφορετικά δίκτυα (${network1} ≠ ${network2})`);
                return false;
            }
            
            console.log(`[ROUTER CONNECTION] WAN ↔ WAN - ΕΠΙΤΡΕΠΕΤΑΙ`);
            return true;
        }
        
        // ΕΛΕΓΧΟΣ 3: LAN ↔ LAN (διπλό NAT - προειδοποίηση)
        if (interface1 === 'lan' && interface2 === 'lan') {
            console.log(`[ROUTER CONNECTION] LAN ↔ LAN - ΕΠΙΚΙΝΔΥΝΟ (διπλό NAT)`);
            return confirm(`ΠΡΟΣΟΧΗ: Σύνδεση LAN ↔ LAN μεταξύ routers μπορεί να προκαλέσει προβλήματα διπλού NAT.\nΘέλετε να συνεχίσετε;`);
        }
        
        // ΚΑΜΙΑ ΑΛΛΗ ΠΕΡΙΠΤΩΣΗ - ΕΠΙΤΡΕΠΕΤΑΙ
        console.log(`[ROUTER CONNECTION] Άλλη σύνδεση - ΕΠΙΤΡΕΠΕΤΑΙ`);
        return true;
    }

    // ==================== ΚΥΡΙΕΣ ΜΕΘΟΔΟΙ ====================

    // Μέθοδος για έλεγχο αν μία συσκευή μπορεί να δεχτεί νέα σύνδεση
    canAcceptConnection(device) {
        // Log always to DevTools console
        console.log('[ΣΥΝΔΕΣΙΜΟΤΗΤΑ][DEBUG CALL] canAcceptConnection called for:', device && device.name, device && device.type);

        if (!device) {
            console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ΑΠΟΡΡΙΦΘΗΚΕ: Δεν βρέθηκε η συσκευή.`);
            if (window.uiManager) window.uiManager.addLog(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ΑΠΟΡΡΙΦΘΗΚΕ: Δεν βρέθηκε η συσκευή.`, "error");
            return false;
        }

        if (device.type === 'switch') {
            console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Η συσκευή ${device.name} (${device.type}) μπορεί να δεχτεί απεριόριστες συνδέσεις (switch).`);
            if (window.uiManager) window.uiManager.addLog(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name}: απεριόριστες συνδέσεις (switch)`, "info");
            return true;
        }

        // --- Εδώ φιλτράρουμε ΜΟΝΟ τις πραγματικές συνδέσεις! ---
        // Βρες όλα τα valid connection ids από τον manager
        const managerConns = Array.isArray(window.connectionManager?.connections)
            ? window.connectionManager.connections
            : [];
        const validConnectionIds = new Set(managerConns.map(conn => conn.id));
        // Για τη συσκευή, φιλτράρουμε ώστε να κρατάμε μόνο όσα connections πραγματικά βρίσκονται στο manager
        const realConnections = Array.isArray(device.connections)
            ? device.connections.filter(id => validConnectionIds.has(id))
            : [];
        const currentConns = realConnections.length;

        if (device.type === 'router') {
            // Routers μπορούν να έχουν 4 συνδέσεις (LAN, WAN και επιπλέον ports)
            let maxConnections = 4;
            console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Το router ${device.name} έχει ${currentConns} / ${maxConnections} έγκυρες συνδέσεις.`);
            if (window.uiManager) window.uiManager.addLog(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Το router ${device.name} έχει ${currentConns} / ${maxConnections} έγκυρες συνδέσεις.`, "info");
            if (currentConns < maxConnections) {
                return true;
            } else {
                console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Το router ${device.name} έχει ήδη το μέγιστο αριθμό συνδέσεων (${maxConnections}).`);
                if (window.uiManager) window.uiManager.addLog(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Το router ${device.name} έχει ήδη το μέγιστο αριθμό συνδέσεων (${maxConnections}).`, "error");
                return false;
            }
        }

        // Υπόλοιπα: μόνο ΜΙΑ πραγματική σύνδεση επιτρέπεται
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Η συσκευή ${device.name} (${device.type}) έχει ${currentConns} έγκυρες συνδέσεις.`);
        if (window.uiManager) window.uiManager.addLog(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Η συσκευή ${device.name} (${device.type}) έχει ${currentConns} έγκυρες συνδέσεις.`, "info");
        if (currentConns < 1) {
            console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Η συσκευή ${device.name} μπορεί να δεχτεί μία σύνδεση.`);
            if (window.uiManager) window.uiManager.addLog(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Η συσκευή ${device.name} μπορεί να δεχτεί μία σύνδεση.`, "success");
            return true;
        } else {
            console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Η συσκευή ${device.name} δεν μπορεί να δεχτεί περισσότερες από μία σύνδεση.`);
            if (window.uiManager) window.uiManager.addLog(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Η συσκευή ${device.name} δεν μπορεί να δεχτεί περισσότερες από μία σύνδεση.`, "error");
            return false;
        }
    }

    // ΔΗΟΡΘΩΜΕΝΗ ΜΕΘΟΔΟΣ ΔΗΜΙΟΥΡΓΙΑΣ ΣΥΝΔΕΣΗΣ ΜΕ ROUTER SUPPORT
    createConnection(device1, device2) {
        console.log(`[ΣΥΝΔΕΣΗ] Έλεγχος: ${device1.name} (${device1.type}) ↔ ${device2.name} (${device2.type})`);
        
        // 1. ΈΛΕΓΧΟΣ: Router ↔ Router connection (ΕΙΔΙΚΗ ΠΕΡΙΠΤΩΣΗ)
        if (device1.type === 'router' && device2.type === 'router') {
            return this.createRouterToRouterConnection(device1, device2);
        }
        
        // 2. Για όλες τις άλλες συνδέσεις, κανονική διαδικασία
        return this.createBasicConnection(device1, device2);
    }
    
    // ΕΙΔΙΚΗ ΜΕΘΟΔΟΣ ΓΙΑ ROUTER ↔ ROUTER ΣΥΝΔΕΣΕΙΣ
    createRouterToRouterConnection(router1, router2) {
        console.log(`[ROUTER↔ROUTER] Δημιουργία σύνδεσης: ${router1.name} ↔ ${router2.name}`);
        
        // Έλεγχος βασικών προϋποθέσεων
        const can1 = this.canAcceptConnection(router1);
        const can2 = this.canAcceptConnection(router2);
        
        if (!can1 || !can2) {
            console.log(`[ROUTER↔ROUTER] ΑΠΟΡΡΙΦΘΗΚΕ: Ένας router δεν μπορεί να δεχτεί σύνδεση`);
            return null;
        }
        
        // Έλεγχος για ύπαρξη σύνδεσης
        const existingConnection = this.connections.find(conn => 
            (conn.device1Id === router1.id && conn.device2Id === router2.id) ||
            (conn.device1Id === router2.id && conn.device2Id === router1.id)
        );
        
        if (existingConnection) {
            console.log(`[ROUTER↔ROUTER] Οι routers είναι ήδη συνδεδεμένοι`);
            return existingConnection;
        }

        // ΠΑΝΤΑ χρησιμοποιούμε τα interface από το JSON (αν υπάρχουν)
        // ή ζητάμε από χρήστη
        let interface1, interface2;

        // Προσπαθούμε να βρούμε τα interface από το workspace manager
        if (window.workspaceManager && window.workspaceManager.currentConnections) {
            const conn = window.workspaceManager.currentConnections.find(c => 
                (c.device1Id === router1.id && c.device2Id === router2.id) ||
                (c.device1Id === router2.id && c.device2Id === router1.id)
            );
            
            if (conn && conn.interface1 && conn.interface2) {
                interface1 = conn.interface1;
                interface2 = conn.interface2;
                console.log(`[ROUTER↔ROUTER] Interface από αρχείο: ${interface1} ↔ ${interface2}`);
            }
        }

        // Αν δεν βρέθηκαν, ζητάμε από χρήστη
        if (!interface1 || !interface2) {
            const interfaceChoice = prompt(
                `Σύνδεση Router ↔ Router:\n\n` +
                `Πώς θέλετε να συνδεθούν οι routers;\n` +
                `1. ${router1.name} (LAN) ↔ ${router2.name} (WAN)\n` +
                `2. ${router1.name} (WAN) ↔ ${router2.name} (LAN)\n` +
                `3. ${router1.name} (LAN) ↔ ${router2.name} (LAN)\n\n` +
                `Εισάγετε 1, 2 ή 3:`,
                "1"
            );
            
            switch(interfaceChoice) {
                case '1':
                    interface1 = 'lan';
                    interface2 = 'wan';
                    break;
                case '2':
                    interface1 = 'wan';
                    interface2 = 'lan';
                    break;
                case '3':
                    interface1 = 'lan';
                    interface2 = 'lan';
                    break;
                default:
                    console.log(`[ROUTER↔ROUTER] Ακυρη επιλογή. Ακύρωση.`);
                    return null;
            }
        }
        
        // Έλεγχος συμβατότητας
        if (!this.canRoutersConnect(router1, router2, interface1, interface2)) {
            console.log(`[ROUTER↔ROUTER] Η σύνδεση δεν είναι συμβατή`);
            return null;
        }
        
        // Ανάθεση WAN IP όπου χρειάζεται
        if (interface1 === 'wan' && (!router1.interfaces.wan.ip || router1.interfaces.wan.ip === 'N/A')) {
            this.assignRouterWanIP(router1, router2);
        }
        if (interface2 === 'wan' && (!router2.interfaces.wan.ip || router2.interfaces.wan.ip === 'N/A')) {
            this.assignRouterWanIP(router2, router1);
        }
        
        // Δημιουργία βασικής σύνδεσης
        const connection = this.createBasicConnection(router1, router2);
        
        if (connection) {
            // Αποθήκευση πληροφορίας interfaces
            if (!router1.connectionInterfaces) router1.connectionInterfaces = {};
            if (!router2.connectionInterfaces) router2.connectionInterfaces = {};
            
            router1.connectionInterfaces[connection.id] = interface1;
            router2.connectionInterfaces[connection.id] = interface2;
            
            connection.interface1 = interface1;
            connection.interface2 = interface2;
            connection.isRouterToRouter = true;
            
            console.log(`[ROUTER↔ROUTER] Δημιουργήθηκε: ${router1.name} (${interface1}) ↔ ${router2.name} (${interface2})`);
            
            // Προσθήκη αυτόματων routes
            this.addAutoRoutesForRouterConnection(router1, router2, interface1, interface2);
            
            // Ενημέρωση UI
            if (window.uiManager) {
                window.uiManager.addLog(`Δημιουργήθηκε σύνδεση router-to-router: ${router1.name} (${interface1}) ↔ ${router2.name} (${interface2})`, 'success');
            }
        }
        
        return connection;
    }

    // Μέθοδος για δημιουργία σύνδεσης με συγκεκριμένο ID
    createConnectionWithId(device1, device2, connectionId) {
        console.log(`[ΣΥΝΔΕΣΗ] Δημιουργία με προκαθορισμένο ID: ${connectionId}`);
        
        // Έλεγχος αν μπορούν να δεχτούν σύνδεση
        const can1 = this.canAcceptConnection(device1);
        const can2 = this.canAcceptConnection(device2);
        
        if (!can1 || !can2) {
            console.log(`[ΣΥΝΔΕΣΗ] Απορρίφθηκε: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`);
            return null;
        }
        
        // Έλεγχος αν υπάρχει ήδη σύνδεση με αυτό το ID
        const existingConnection = this.connections.find(conn => conn.id === connectionId);
        if (existingConnection) {
            console.log(`[ΣΥΝΔΕΣΗ] Σύνδεση με ID ${connectionId} υπάρχει ήδη`);
            return existingConnection;
        }
        
        // Δημιουργία σύνδεσης με το προκαθορισμένο ID
        const connection = {
            id: connectionId,
            device1Id: device1.id,
            device2Id: device2.id,
            type: 'direct',
            canCommunicate: true,
            timestamp: new Date().toISOString()
        };
        
        // Προσθήκη στις λίστες
        this.connections.push(connection);
        
        // Ενημέρωση των συσκευών
        if (!device1.connections) device1.connections = [];
        if (!device2.connections) device2.connections = [];
        
        device1.connections.push(connectionId);
        device2.connections.push(connectionId);
        
        // Έλεγχος επικοινωνίας
        const communication = this.canDevicesCommunicateDirectly(device1, device2);
        connection.canCommunicate = communication.canCommunicate;
        connection.type = communication.viaGateway ? 'routed' : 'direct';
        
        console.log(`[ΣΥΝΔΕΣΗ] Δημιουργήθηκε με ID: ${connectionId}`);
        
        // Ενημέρωση UI
        if (window.uiManager) {
            window.uiManager.addLog(`Δημιουργήθηκε σύνδεση: ${device1.name} ↔ ${device2.name}`, 'success');
            this.updateConnectionsVisual();
        }
        
        return connection;
    }

    // Μέθοδος για απομάκρυνση διπλότυπων συνδέσεων
    removeDuplicateConnections() {
        console.log('[CLEANUP] Απομάκρυνση διπλότυπων συνδέσεων...');
        
        const uniqueConnections = [];
        const seenPairs = new Set();
        const duplicatesRemoved = [];
        
        this.connections.forEach(connection => {
            const pairKey = [connection.device1Id, connection.device2Id].sort().join('|');
            
            if (!seenPairs.has(pairKey)) {
                seenPairs.add(pairKey);
                uniqueConnections.push(connection);
            } else {
                duplicatesRemoved.push(connection.id);
                
                // Αφαίρεση από τις συσκευές
                const device1 = window.deviceManager?.getDeviceById(connection.device1Id);
                const device2 = window.deviceManager?.getDeviceById(connection.device2Id);
                
                if (device1 && device1.connections) {
                    const index = device1.connections.indexOf(connection.id);
                    if (index !== -1) device1.connections.splice(index, 1);
                }
                
                if (device2 && device2.connections) {
                    const index = device2.connections.indexOf(connection.id);
                    if (index !== -1) device2.connections.splice(index, 1);
                }
            }
        });
        
        this.connections = uniqueConnections;
        
        console.log(`[CLEANUP] Αφαιρέθηκαν ${duplicatesRemoved.length} διπλότυπες συνδέσεις:`, duplicatesRemoved);
        return duplicatesRemoved;
    }
    
    // Αφαίρεση σύνδεσης
    removeConnection(connection) {
        const device1 = window.deviceManager.getDeviceById(connection.device1Id);
        const device2 = window.deviceManager.getDeviceById(connection.device2Id);
        
        if (device1 && device1.connections) {
            const index1 = device1.connections.indexOf(connection.id);
            if (index1 !== -1) device1.connections.splice(index1, 1);
        }
        
        if (device2 && device2.connections) {
            const index2 = device2.connections.indexOf(connection.id);
            if (index2 !== -1) device2.connections.splice(index2, 1);
        }
        
        // Αφαίρεση από το DOM
        const connEl = document.getElementById(connection.id);
        if (connEl) connEl.remove();
        
        // Αφαίρεση από τη λίστα συνδέσεων
        const connIndex = this.connections.indexOf(connection);
        if (connIndex !== -1) this.connections.splice(connIndex, 1);
        
        console.log(`[ΣΥΝΔΕΣΗ ΔΙΑΓΡΑΦΗΚΕ] ${connection.id}`);
        return connection;
    }
    
    // Αφαίρεση σύνδεσης με βάση το ID
    removeConnectionById(connectionId) {
        const connection = this.connections.find(c => c.id === connectionId);
        if (connection) {
            return this.removeConnection(connection);
        }
        return null;
    }
    
    // Ενημέρωση όλων των συνδέσεων
    updateAllConnections(devices) {
        console.log(`[ΕΝΗΜΕΡΩΣΗ ΣΥΝΔΕΣΕΩΝ] Σύνολο συνδέσεων: ${this.connections.length}`);
        
        // ΔΙΟΡΘΩΣΗ: Επαναφορά arrays συνδέσεων αν λείπουν
        devices.forEach(device => {
            if (!device.connections) {
                console.log(`[ΕΝΗΜΕΡΩΣΗ] Δημιουργία array συνδέσεων για ${device.name}`);
                device.connections = [];
            }
        });
        
        this.connections.forEach(conn => {
            const device1 = devices.find(d => d.id === conn.device1Id);
            const device2 = devices.find(d => d.id === conn.device2Id);
            
            if (device1 && device2) {
                const communication = this.canDevicesCommunicateDirectly(device1, device2);
                conn.canCommunicate = communication.canCommunicate;
                conn.type = communication.viaGateway ? 'routed' : 'direct';
            }
        });
        
        this.updateConnectionsVisual();
    }
    
    updateConnectionsVisual() {
        document.querySelectorAll('.connection').forEach(el => el.remove());
        
        this.connections.forEach(conn => {
            const device1 = window.deviceManager.getDeviceById(conn.device1Id);
            const device2 = window.deviceManager.getDeviceById(conn.device2Id);
            
            if (!device1 || !device2) return;
            
            const x1 = device1.x + 60;
            const y1 = device1.y + 60;
            const x2 = device2.x + 60;
            const y2 = device2.y + 60;
            
            const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            
            const isSwitch = (device) => device.type === 'switch'; // Προσθήκη εξαίρεσης για switches
            
            let colorClass;
            if (!conn.canCommunicate && !(isSwitch(device1) || isSwitch(device2))) {
                colorClass = 'invalid-connection';
            } else if (conn.type === 'routed') {
                colorClass = 'routed-connection';
            } else {
                colorClass = 'valid-connection';
            }
            
            const connectionEl = document.createElement('div');
            connectionEl.className = `connection ${colorClass}`;
            connectionEl.id = conn.id;
            connectionEl.style.width = `${length}px`;
            connectionEl.style.left = `${x1}px`;
            connectionEl.style.top = `${y1}px`;
            connectionEl.style.transform = `rotate(${angle}deg)`;
            
            document.getElementById('workspace').appendChild(connectionEl);
        });
    }    
    
    // Έλεγχος επικοινωνίας μεταξύ συσκευών - ΔΙΟΡΘΩΜΕΝΗ ΜΕ INTERNET ACCESS
    canDevicesCommunicateDirectly(device1, device2) {
        console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ] Έλεγχος: ${device1.name} ↔ ${device2.name}`);
        
        if (device1.id === device2.id) {
            return { canCommunicate: true, viaGateway: false };
        }
        
        // ΕΛΕΓΧΟΣ: Αν είναι συνδεδεμένοι μέσω switch
        if (this.areDevicesConnectedViaSwitch(device1, device2)) {
            console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ] Συνδεδεμένοι μέσω switch`);
            
            // Αν και οι δύο είναι switches, απλή σύνδεση
            if (device1.type === 'switch' && device2.type === 'switch') {
                return { canCommunicate: true, viaGateway: false };
            }
            
            // Αν ένας είναι switch (χωρίς IP) και ο άλλος έχει IP
            if ((device1.type === 'switch' && device1.ip === 'N/A') || 
                (device2.type === 'switch' && device2.ip === 'N/A')) {
                return { canCommunicate: true, viaGateway: false };
            }
            
            // Για συσκευές με IP που είναι συνδεδεμένες μέσω switch
            return this.checkCommunicationThroughSwitch(device1, device2);
        }
        
        if (!this.areDevicesConnected(device1, device2)) {
            console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ] Οι συσκευές ${device1.name} και ${device2.name} δεν είναι φυσικά συνδεδεμένες`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        // ΝΕΟ: Έλεγχος για εξωτερικές IP (Internet)
        const device1IP = this.getDeviceIP(device1);
        const device2IP = this.getDeviceIP(device2);
        
        if (this.isExternalIP(device2IP) && device1.type !== 'router') {
            console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ] Το ${device2IP} είναι εξωτερικό IP, αλλά η ${device1.name} δεν είναι router`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        if (this.isExternalIP(device1IP) && device2.type !== 'router') {
            console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ] Το ${device1IP} είναι εξωτερικό IP, αλλά η ${device2.name} δεν είναι router`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        // Λογική για routers
        if (device1.type === 'router') {
            return this.canCommunicateWithRouter(device1, device2);
        }
        if (device2.type === 'router') {
            return this.canCommunicateWithRouter(device2, device1);
        }
        
        // Τυπικές συσκευές με IP
        return this.canStandardDevicesCommunicate(device1, device2);
    }
    
    // Έλεγχος επικοινωνίας μέσω switch
    checkCommunicationThroughSwitch(device1, device2) {
        console.log(`[SWITCH] Επικοινωνία: ${device1.name} ↔ ${device2.name} μέσω switch`);
        
        const ip1 = this.getDeviceIP(device1);
        const ip2 = this.getDeviceIP(device2);
    
        // Αν δεν έχουν IP, δεν μπορούν να επικοινωνήσουν
        if ((!ip1 || ip1 === 'N/A' || ip1 === '0.0.0.0' || ip1 === undefined) ||
            (!ip2 || ip2 === 'N/A' || ip2 === '0.0.0.0' || ip2 === undefined)) {
            console.log(`[SWITCH] Μία ή και οι δύο συσκευές δεν έχουν IP: ${ip1}, ${ip2}`);
            return { canCommunicate: false, viaGateway: false };
        }        
    
        const subnet1 = this.getDeviceSubnet(device1);
        const subnet2 = this.getDeviceSubnet(device2);
    
        // Έλεγχος αν είναι στο ίδιο δίκτυο
        console.log(`[SWITCH] Έλεγχος ίδιου δικτύου: ${ip1}/${subnet1} vs ${ip2}/${subnet2}`);
        if (areInSameNetwork(ip1, ip2, subnet1, subnet2)) {
            console.log(`[SWITCH] Ίδιο δίκτυο! Επικοινωνία δυνατή μέσω switch`);
            return { canCommunicate: true, viaGateway: false };
        }
        
        // Αν είναι σε διαφορετικά δίκτυα, πρέπει να έχουν gateway
        console.log(`[SWITCH] Διαφορετικά δίκτυα. Έλεγχος για gateway...`);
        
        // Αν ΟΥΤΕ ΜΙΑ από τις συσκευές έχει gateway, ΔΕΝ μπορούν να επικοινωνήσουν
        const gateway1 = this.getDeviceGateway(device1);
        const gateway2 = this.getDeviceGateway(device2);
        
        if ((!gateway1 || gateway1 === '0.0.0.0' || gateway1 === 'N/A') &&
            (!gateway2 || gateway2 === '0.0.0.0' || gateway2 === 'N/A')) {
            console.log(`[SWITCH] ΔΕΝ έχει ρυθμιστεί GATEWAY. Επικοινωνία αδύνατη μεταξύ διαφορετικών δικτύων`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        // Έλεγχος για gateway
        return this.checkGatewayCommunication(device1, device2);
    }
    
    // Έλεγχος αν δύο συσκευές είναι συνδεδεμένες μέσω switch
    areDevicesConnectedViaSwitch(device1, device2) {
        // Βρες όλες τις συσκευές που συνδέουν τις δύο συσκευές
        const path = this.findPathBetweenDevices(device1, device2);
        
        if (!path || path.length < 3) {
            return false;
        }
        
        // Έλεγχος αν υπάρχει switch στη διαδρομή (εκτός από τις άκρες)
        for (let i = 1; i < path.length - 1; i++) {
            if (path[i].type === 'switch') {
                console.log(`[ΜΕΣΩ SWITCH] ${device1.name} ↔ ${device2.name} μέσω ${path[i].name}`);
                return true;
            }
        }
        
        return false;
    }
    
    // Έλεγχος επικοινωνίας τυπικών συσκευών
    canStandardDevicesCommunicate(device1, device2) {
        console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] ${device1.name} ↔ ${device2.name}`);
        
        const ip1 = this.getDeviceIP(device1);
        const ip2 = this.getDeviceIP(device2);
        
        // Αν δεν έχουν IP, δεν μπορούν να επικοινωνήσουν
        if ((!ip1 || ip1 === 'N/A' || ip1 === '0.0.0.0' || ip1 === undefined) ||
            (!ip2 || ip2 === 'N/A' || ip2 === '0.0.0.0' || ip2 === undefined)) {
            console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] Μία ή και οι δύο συσκευές δεν έχουν IP`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        // Έλεγχος αν είναι στο ίδιο δίκτυο
        const subnet1 = this.getDeviceSubnet(device1);
        const subnet2 = this.getDeviceSubnet(device2);
        
        console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] Έλεγχος ίδιου δικτύου: ${ip1}/${subnet1} vs ${ip2}/${subnet2}`);
        if (areInSameNetwork(ip1, ip2, subnet1, subnet2)) {
            console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] Ίδιο δίκτυο! Άμεση επικοινωνία δυνατή`);
            return { canCommunicate: true, viaGateway: false };
        }
        
        // ΔΙΟΡΘΩΣΗ: Αν είναι σε διαφορετικά δίκτυα, πρέπει να έχουν gateway
        console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] Διαφορετικά δίκτυα. Έλεγχος για gateway...`);
        
        // Αν ΟΥΤΕ ΜΙΑ από τις συσκευές έχει gateway, ΔΕΝ μπορούν να επικοινωνήσουν
        const gateway1 = this.getDeviceGateway(device1);
        const gateway2 = this.getDeviceGateway(device2);
        
        if ((!gateway1 || gateway1 === '0.0.0.0' || gateway1 === 'N/A') &&
            (!gateway2 || gateway2 === '0.0.0.0' || gateway2 === 'N/A')) {
            console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] ΔΕΝ έχει ρυθμιστεί GATEWAY. Επικοινωνία αδύνατη μεταξύ διαφορετικών δικτύων`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        // Έλεγχος για gateway
        console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] Έλεγχος επικοινωνίας μέσω gateway...`);
        return this.checkGatewayCommunication(device1, device2);
    }
    
    // Έλεγχος επικοινωνίας μέσω gateway
    checkGatewayCommunication(device1, device2) {
        console.log(`[GATEWAY] Έλεγχος: ${device1.name} → ${device2.name}`);
        
        // Έλεγχος αν η device1 έχει gateway και μπορεί να φτάσει στη device2
        const gateway1 = this.getDeviceGateway(device1);
        if (gateway1 && gateway1 !== '0.0.0.0' && gateway1 !== 'N/A') {
            console.log(`[GATEWAY] Η ${device1.name} έχει gateway: ${gateway1}`);
            const gatewayDevice = window.deviceManager.getDeviceByIP(gateway1);
            
            if (gatewayDevice) {
                console.log(`[GATEWAY] Βρέθηκε συσκευή gateway: ${gatewayDevice.name}`);
                
                // Έλεγχος αν υπάρχει διαδρομή προς το gateway (άμεσα ή μέσω switch)
                if (this.areDevicesConnected(device1, gatewayDevice) || this.areDevicesConnectedViaSwitch(device1, gatewayDevice)) {
                    console.log(`[GATEWAY] Η ${device1.name} είναι συνδεδεμένη με το gateway`);
                    const gatewayComm = this.canDevicesCommunicateDirectly(gatewayDevice, device2);
                    if (gatewayComm.canCommunicate) {
                        console.log(`[GATEWAY] Το gateway μπορεί να φτάσει στον προορισμό`);
                        return { canCommunicate: true, viaGateway: true };
                    }
                }
            }
        }
        
        // Έλεγχος αν η device2 έχει gateway και μπορεί να φτάσει στη device1
        const gateway2 = this.getDeviceGateway(device2);
        if (gateway2 && gateway2 !== '0.0.0.0' && gateway2 !== 'N/A') {
            console.log(`[GATEWAY] Η ${device2.name} έχει gateway: ${gateway2}`);
            const gatewayDevice = window.deviceManager.getDeviceByIP(gateway2);
            
            if (gatewayDevice) {
                console.log(`[GATEWAY] Βρέθηκε συσκευή gateway: ${gatewayDevice.name}`);
                
                // Έλεγχος αν υπάρχει διαδρομή προς το gateway (άμεσα ή μέσω switch)
                if (this.areDevicesConnected(device2, gatewayDevice) || this.areDevicesConnectedViaSwitch(device2, gatewayDevice)) {
                    console.log(`[GATEWAY] Η ${device2.name} είναι συνδεδεμένη με το gateway`);
                    const gatewayComm = this.canDevicesCommunicateDirectly(device1, gatewayDevice);
                    if (gatewayComm.canCommunicate) {
                        console.log(`[GATEWAY] Το gateway μπορεί να φτάσει στην πηγή`);
                        return { canCommunicate: true, viaGateway: true };
                    }
                }
            }
        }
        
        console.log(`[GATEWAY] Καμία επικοινωνία μέσω gateway δεν είναι δυνατή`);
        return { canCommunicate: false, viaGateway: false };
    }
    
    // Έλεγχος επικοινωνίας με router - ΔΙΟΡΘΩΜΕΝΗ ΜΕ INTERFACE SUPPORT
    canCommunicateWithRouter(router, otherDevice) {
        console.log(`[ROUTER] Επικοινωνία: ${router.name} ↔ ${otherDevice.name}`);
        console.log(`[ROUTER] Router WAN: ${router.interfaces.wan.ip}, LAN: ${router.interfaces.lan.ip}`);
        
        const otherDeviceIP = this.getDeviceIP(otherDevice);
        console.log(`[ROUTER] Άλλη συσκευή: ${otherDevice.name} (${otherDevice.type}), IP: ${otherDeviceIP}`);
        
        // 1. Router ↔ Switch (χωρίς IP) - φυσική σύνδεση
        if (otherDevice.type === 'switch' && otherDevice.ip === 'N/A') {
            console.log(`[ROUTER] Άμεση σύνδεση με switch`);
            return { canCommunicate: true, viaGateway: false };
        }
        
        // 2. ΆΜΕΣΗ ΣΥΝΔΕΣΗ: Αν ο router και ο προορισμός είναι συνδεδεμένοι άμεσα
        if (this.areDevicesConnected(router, otherDevice)) {
            console.log(`[ROUTER] ΆΜΕΣΗ ΣΥΝΔΕΣΗ με ${otherDevice.name}`);
            
            // Αν ο προορισμός είναι Cloud ή Router, επικοινωνία ΔΥΝΑΤΗ
            if (otherDevice.type === 'cloud' || otherDevice.type === 'router') {
                console.log(`[ROUTER] Άμεση σύνδεση Cloud/Router, επικοινωνία ΔΥΝΑΤΗ`);
                
                // Ειδική περίπτωση: Router ↔ Router
                if (otherDevice.type === 'router') {
                    // Έλεγχος με ποιο interface είναι συνδεδεμένοι
                    const interface1 = this.getInterfaceForRouterConnection(router, otherDevice);
                    const interface2 = this.getInterfaceForRouterConnection(otherDevice, router);
                    
                    console.log(`[ROUTER↔ROUTER] Interface: ${interface1} ↔ ${interface2}`);
                    
                    // Έλεγχος αν είναι στο ίδιο δίκτυο βάσει interface
                    if (interface1 === 'wan' && interface2 === 'lan') {
                        // Router1 WAN ↔ Router2 LAN
                        const routerWanIP = router.interfaces.wan.ip;
                        const otherLanIP = otherDevice.interfaces.lan.ip;
                        
                        if (routerWanIP && routerWanIP !== 'N/A' && otherLanIP && otherLanIP !== 'N/A') {
                            const wanNetwork = this.getNetworkFromIP(routerWanIP, router.interfaces.wan.subnetMask);
                            const lanNetwork = this.getNetworkFromIP(otherLanIP, otherDevice.interfaces.lan.subnetMask);
                            
                            if (wanNetwork === lanNetwork) {
                                console.log(`[ROUTER↔ROUTER] Ίδιο δίκτυο WAN ↔ LAN`);
                                return { canCommunicate: true, viaGateway: false };
                            }
                        }
                    } else if (interface1 === 'lan' && interface2 === 'wan') {
                        // Router1 LAN ↔ Router2 WAN
                        const routerLanIP = router.interfaces.lan.ip;
                        const otherWanIP = otherDevice.interfaces.wan.ip;
                        
                        if (routerLanIP && routerLanIP !== 'N/A' && otherWanIP && otherWanIP !== 'N/A') {
                            const lanNetwork = this.getNetworkFromIP(routerLanIP, router.interfaces.lan.subnetMask);
                            const wanNetwork = this.getNetworkFromIP(otherWanIP, otherDevice.interfaces.wan.subnetMask);
                            
                            if (lanNetwork === wanNetwork) {
                                console.log(`[ROUTER↔ROUTER] Ίδιο δίκτυο LAN ↔ WAN`);
                                return { canCommunicate: true, viaGateway: false };
                            }
                        }
                    }
                }
                
                return { canCommunicate: true, viaGateway: false };
            }
            
            // Αν ο προορισμός έχει IP, έλεγχος αν είναι στο ίδιο subnet
            if (otherDeviceIP && otherDeviceIP !== 'N/A') {
                const routerSubnet = router.interfaces.lan.subnetMask;
                const otherSubnet = this.getDeviceSubnet(otherDevice);
                
                // Ειδική περίπτωση: Router ↔ Cloud με διαφορετικά IP
                if (otherDevice.type === 'cloud') {
                    console.log(`[ROUTER] Άμεση σύνδεση με Cloud, αποδέχομαι επικοινωνία`);
                    return { canCommunicate: true, viaGateway: false };
                }
            }
        }
        
        // Έλεγχος αν το router έχει έγκυρο LAN IP
        const routerLanIP = router.interfaces.lan.ip;
        if (!routerLanIP || routerLanIP === 'N/A' || routerLanIP === '0.0.0.0' || routerLanIP === undefined) {
            console.log(`[ROUTER] Το router δεν έχει έγκυρο LAN IP`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        // Έλεγχος αν η συσκευή είναι στο LAN του router
        if (otherDeviceIP && otherDeviceIP !== 'N/A' && otherDeviceIP !== '0.0.0.0' && otherDeviceIP !== undefined) {
            console.log(`[ROUTER] Έλεγχος αν το ${otherDeviceIP} είναι στο ίδιο δίκτυο με το router LAN ${routerLanIP}`);
            
            const routerSubnet = router.interfaces.lan.subnetMask;
            const otherSubnet = this.getDeviceSubnet(otherDevice);
            
            if (areInSameNetwork(otherDeviceIP, routerLanIP, otherSubnet, routerSubnet)) {
                console.log(`[ROUTER] Η συσκευή είναι στο LAN του router`);
                return { canCommunicate: true, viaGateway: false };
            }
            
            // ΝΕΟ: Έλεγχος για εξωτερικές IP (Internet access)
            if (this.isExternalIP(otherDeviceIP)) {
                console.log(`[ROUTER] Το ${otherDeviceIP} είναι ΕΞΩΤΕΡΙΚΟ IP (Internet)`);
                
                // 3. Έλεγχος αν το router είναι ΣΥΝΔΕΔΕΜΕΝΟ με τον προορισμό
                // Αναζήτηση ΌΛΩΝ των routers στο δίκτυο
                const allRouters = window.deviceManager.devices.filter(d => d.type === 'router');
                
                console.log(`[ROUTER] Αναζήτηση σε ${allRouters.length} routers για σύνδεση με ${otherDevice.name}`);
                
                for (const someRouter of allRouters) {
                    // Έλεγχος αν ο άλλος router είναι ΣΥΝΔΕΔΕΜΕΝΟΣ με τον προορισμό
                    if (this.areDevicesConnected(someRouter, otherDevice)) {
                        console.log(`[ROUTER] Το ${otherDevice.name} είναι ΣΥΝΔΕΔΕΜΕΝΟ με ${someRouter.name}`);
                        
                        // Έλεγχος αν υπάρχει διαδρομή από τον τρέχοντα router προς εκείνον
                        if (someRouter.id === router.id) {
                            console.log(`[ROUTER] Είναι ο ΙΔΙΟΣ router! Άμεση σύνδεση`);
                            return { 
                                canCommunicate: true, 
                                viaGateway: false,
                                directConnection: true 
                            };
                        }
                        
                        const pathToOtherRouter = this.findPathBetweenDevices(router, someRouter);
                        if (pathToOtherRouter) {
                            console.log(`[ROUTER] Υπάρχει διαδρομή προς τον router με τον προορισμό: ${pathToOtherRouter.map(d => d.name).join(' → ')}`);
                            return { 
                                canCommunicate: true, 
                                viaGateway: true,
                                externalTarget: true,
                                connectedVia: someRouter.name,
                                path: pathToOtherRouter
                            };
                        }
                    }
                }
                
                // 4. Έλεγχος για internet access (WAN)
                console.log(`[ROUTER] Έλεγχος για internet access...`);
                
                // Έλεγχος αν το router έχει WAN και gateway
                const routerWanIP = router.interfaces.wan.ip;
                const routerWanGateway = router.interfaces.wan.gateway;
                
                console.log(`[ROUTER] Router WAN: ${routerWanIP}, Gateway: ${routerWanGateway}`);
                
                if (routerWanIP !== 'N/A' && routerWanGateway !== '0.0.0.0') {
                    console.log(`[ROUTER] Το router έχει πρόσβαση στο Internet`);
                    return { 
                        canCommunicate: true, 
                        viaGateway: true, 
                        requiresNAT: true,
                        externalTarget: true,
                        internetAccess: true
                    };
                } else {
                    // Έλεγχος για default route
                    if (router.routingTable && router.routingTable.length > 0) {
                        const hasDefaultRoute = router.routingTable.some(route => 
                            route.destination === '0.0.0.0/0' || route.destination === '0.0.0.0'
                        );
                        
                        if (hasDefaultRoute) {
                            console.log(`[ROUTER] Το router έχει default route`);
                            return { 
                                canCommunicate: true, 
                                viaGateway: true, 
                                requiresNAT: true,
                                externalTarget: true,
                                hasDefaultRoute: true
                            };
                        }
                    }
                }
                
                console.log(`[ROUTER] Το router ΔΕΝ έχει πρόσβαση στο Internet`);
                return { canCommunicate: false, viaGateway: false };
            }
        }
        
        // Έλεγχος αν η συσκευή έχει ως gateway το router LAN
        const otherGateway = this.getDeviceGateway(otherDevice);
        if (otherGateway && otherGateway !== '0.0.0.0' && otherGateway !== 'N/A') {
            console.log(`[ROUTER] Gateway συσκευής: ${otherGateway}, Router LAN: ${routerLanIP}`);
            if (otherGateway === routerLanIP) {
                console.log(`[ROUTER] Η συσκευή χρησιμοποιεί το router ως gateway`);
                
                // Έλεγχος αν το router γνωρίζει τον προορισμό (routes)
                if (router.routingTable && router.routingTable.length > 0) {
                    const targetNetwork = this.getNetworkAddress(otherDeviceIP, this.getDeviceSubnet(otherDevice));
                    const hasRoute = router.routingTable.some(route => 
                        this.isIPInNetwork(otherDeviceIP, route.network, route.mask)
                    );
                    
                    if (hasRoute) {
                        console.log(`[ROUTER] Το router έχει διαδρομή προς ${otherDeviceIP}`);
                        return { canCommunicate: true, viaGateway: true };
                    } else {
                        console.log(`[ROUTER] Το router ΔΕΝ έχει διαδρομή προς ${otherDeviceIP}`);
                        return { canCommunicate: false, viaGateway: true };
                    }
                }
                
                return { canCommunicate: true, viaGateway: true };
            }
        }
        
        // Έλεγχος για WAN communication (Cloud ↔ Router ή Router ↔ Router μέσω WAN)
        if (otherDevice.type === 'cloud' || otherDevice.type === 'router') {
            const routerWanIP = router.interfaces.wan.ip;
            if (routerWanIP && routerWanIP !== 'N/A' && routerWanIP !== '0.0.0.0' && routerWanIP !== undefined) {
                
                const routerWanSubnet = router.interfaces.wan.subnetMask;
                const otherSubnet = this.getDeviceSubnet(otherDevice);
                
                if (otherDeviceIP && areInSameNetwork(otherDeviceIP, routerWanIP, 
                                                     otherSubnet, routerWanSubnet)) {
                    console.log(`[ROUTER] WAN επικοινωνία με ${otherDevice.name}`);
                    return { canCommunicate: true, viaGateway: false };
                }
            }
        }
        
        console.log(`[ROUTER] Καμία επικοινωνία δεν είναι δυνατή`);
        return { canCommunicate: false, viaGateway: false };
    }
    
    // Βοηθητικές συναρτήσεις
    areDevicesConnected(device1, device2) {
        // ΔΙΟΡΘΩΣΗ: Έλεγχος αν υπάρχουν τα arrays πρώτα
        if (!device1.connections || !device2.connections) {
            console.log(`[ΠΡΟΕΙΔΟΠΟΙΗΣΗ ΣΥΝΔΕΣΗΣ] Λείπουν array συνδέσεων για ${device1.name} ή ${device2.name}`);
            return false;
        }
        
        const isConnected = this.connections.some(conn => 
            (conn.device1Id === device1.id && conn.device2Id === device2.id) ||
            (conn.device1Id === device2.id && conn.device2Id === device1.id)
        );
        
        console.log(`[ΣΥΝΔΕΔΕΜΕΝΕΣ] ${device1.name} ↔ ${device2.name}: ${isConnected}`);
        return isConnected;
    }
    
    shouldUseGateway(sourceDevice, destIP, destSubnetMask = '255.255.255.0') {
        const sourceIP = this.getDeviceIP(sourceDevice);
        const sourceSubnet = this.getDeviceSubnet(sourceDevice);
        
        if (!sourceIP || sourceIP === 'N/A') return false;
        
        // Αν η πηγή και ο προορισμός είναι στο ίδιο δίκτυο, ΔΕΝ χρειάζεται gateway
        if (areInSameNetwork(sourceIP, destIP, sourceSubnet, destSubnetMask)) {
            return false;
        }
        
        return true;
    }
    
    // Βρίσκει όλες τις συνδεδεμένες συσκευές μιας συσκευής
    getConnectedDevices(device) {
        const connected = [];
        
        // ΔΙΟΡΘΩΣΗ: Αν λείπει το array, επέστρεψε κενό
        if (!device.connections) {
            console.log(`[ΛΗΨΗ ΣΥΝΔΕΣΕΩΝ] Δεν υπάρχει array συνδέσεων για ${device.name}`);
            return connected;
        }
        
        device.connections.forEach(connId => {
            const conn = this.connections.find(c => c.id === connId);
            if (conn) {
                const otherId = conn.device1Id === device.id ? conn.device2Id : conn.device1Id;
                const otherDevice = window.deviceManager.getDeviceById(otherId);
                if (otherDevice) {
                    connected.push(otherDevice);
                }
            }
        });
        
        console.log(`[ΣΥΝΔΕΔΕΜΕΝΕΣ ΣΥΣΚΕΥΕΣ] ${device.name}: ${connected.map(d => d.name).join(', ')}`);
        return connected;
    }
    
    // Βρίσκει διαδρομή μεταξύ δύο συσκευών - ΠΛΗΡΩΣ ΔΙΟΡΘΩΜΕΝΗ (BFS)
    findPathBetweenDevices(device1, device2) {
        if (device1.id === device2.id) return [device1];
        
        console.log(`[ΔΙΑΔΡΟΜΗ] Εύρεση διαδρομής: ${device1.name} → ${device2.name}`);
        
        // 1. Άμεση σύνδεση
        if (this.areDevicesConnected(device1, device2)) {
            console.log(`[ΔΙΑΔΡΟΜΗ] Βρέθηκε άμεση σύνδεση`);
            return [device1, device2];
        }
        
        // 2. BFS για εύρεση διαδρομής
        const visited = new Set();
        const queue = [{ device: device1, path: [device1] }];
        visited.add(device1.id);
        
        while (queue.length > 0) {
            const current = queue.shift();
            const connectedDevices = this.getConnectedDevices(current.device);
            
            console.log(`[ΔΙΑΔΡΟΜΗ] Τρέχουσα: ${current.device.name}, Συνδεδεμένες: ${connectedDevices.map(d => d.name).join(', ')}`);
            
            for (const neighbor of connectedDevices) {
                if (visited.has(neighbor.id)) continue;
                
                visited.add(neighbor.id);
                const newPath = [...current.path, neighbor];
                
                // Αν φτάσαμε στον προορισμό
                if (neighbor.id === device2.id) {
                    console.log(`[ΔΙΑΔΡΟΜΗ] Βρέθηκε διαδρομή: ${newPath.map(d => d.name).join(' → ')}`);
                    return newPath;
                }
                
                queue.push({ device: neighbor, path: newPath });
            }
        }
        
        console.log(`[ΔΙΑΔΡΟΜΗ] ΔΕΝ ΒΡΕΘΗΚΕ διαδρομή από ${device1.name} προς ${device2.name}`);
        return null;
    }
    
    // Έλεγχος επικοινωνίας με πλήρη διαδρομή
    canDevicesCommunicateWithPath(device1, device2) {
        const path = this.findPathBetweenDevices(device1, device2);
        
        console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ ΜΕ ΔΙΑΔΡΟΜΗ] ${device1.name} → ${device2.name}:`, 
                   path ? path.map(d => d.name).join(' → ') : 'ΔΕΝ ΥΠΑΡΧΕΙ ΔΙΑΔΡΟΜΗ');
        
        if (!path || path.length < 2) {
            console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ ΜΕ ΔΙΑΔΡΟΜΗ] Δεν υπάρχει διαδρομή ή είναι άκυρη`);
            return { canCommunicate: false, viaGateway: false, path: null };
        }
        
        // Χρησιμοποιούμε τη νέα μέθοδο canDevicesCommunicateDirectly
        const directComm = this.canDevicesCommunicateDirectly(device1, device2);
        
        if (directComm.canCommunicate) {
            console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ ΜΕ ΔΙΑΔΡΟΜΗ] Επικοινωνία δυνατή: ${directComm.viaGateway ? 'μέσω Gateway' : 'άμεσα'}`);
            return { 
                canCommunicate: true, 
                viaGateway: directComm.viaGateway, 
                path: path 
            };
        }
        
        console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ ΜΕ ΔΙΑΔΡΟΜΗ] Επικοινωνία ΔΕΝ είναι δυνατή μεταξύ ${device1.name} και ${device2.name}`);
        return { canCommunicate: false, viaGateway: false, path: null };
    }
    
    // Νέες μέθοδοι για UI
    removeDevice(device) {
        // Αφαίρεση όλων των συνδέσεων της συσκευής
        const connectionsToRemove = [...device.connections];
        connectionsToRemove.forEach(connId => {
            this.removeConnectionById(connId);
        });
        
        return device;
    }
    
    // Καθαρισμός όλων των συνδέσεων
    clearAllConnections() {
        // Δημιουργία αντίγραφου για να αποφύγουμε προβλήματα κατά τη διαγραφή
        const connectionsCopy = [...this.connections];
        connectionsCopy.forEach(connection => {
            this.removeConnection(connection);
        });
        
        this.connections = [];
        this.packets = [];
    }
    
    // Βοηθητική συνάρτηση: getNetworkAddress
    getNetworkAddress(ip, subnetMask) {
        if (!ip || ip === 'N/A') return null;
        const ipParts = ip.split('.').map(Number);
        const maskParts = subnetMask.split('.').map(Number);
        
        const networkParts = ipParts.map((part, i) => part & maskParts[i]);
        return networkParts.join('.');
    }
    
    // Βοηθητική συνάρτηση: isIPInNetwork
    isIPInNetwork(ip, network, subnetMask) {
        const ipNetwork = this.getNetworkAddress(ip, subnetMask);
        return ipNetwork === network;
    }

    // Μέθοδος αυτόματης δημιουργίας routes για router
    autoGenerateRoutesForRouter(router) {
        console.log(`[AUTO ROUTES] Δημιουργία routes για τον router: ${router.name}`);
        
        // Δημιουργία κενής routing table αν δεν υπάρχει
        if (!router.routingTable) {
            router.routingTable = [];
        }
        
        const existingRoutes = [...router.routingTable];
        const newRoutes = [];
        
        try {
            // 1. Προσθήκη local routes για τα interface του router
            if (router.type === 'router') {
                // LAN interface
                if (router.interfaces.lan.ip && router.interfaces.lan.ip !== 'N/A') {
                    const lanNetwork = this.getNetworkFromIP(router.interfaces.lan.ip, router.interfaces.lan.subnetMask || '255.255.255.0');
                    const lanRoute = {
                        network: lanNetwork,
                        mask: router.interfaces.lan.subnetMask || '255.255.255.0',
                        gateway: '0.0.0.0', // Directly connected
                        interface: 'lan',
                        metric: 0
                    };
                    
                    // Έλεγχος αν υπάρχει ήδη αυτό το route
                    if (!this.routeExists(router.routingTable, lanRoute)) {
                        router.routingTable.push(lanRoute);
                        newRoutes.push(lanRoute);
                    }
                }
                
                // WAN interface
                if (router.interfaces.wan.ip && router.interfaces.wan.ip !== 'N/A') {
                    const wanNetwork = this.getNetworkFromIP(router.interfaces.wan.ip, router.interfaces.wan.subnetMask || '255.255.255.0');
                    const wanRoute = {
                        network: wanNetwork,
                        mask: router.interfaces.wan.subnetMask || '255.255.255.0',
                        gateway: '0.0.0.0', // Directly connected
                        interface: 'wan',
                        metric: 0
                    };
                    
                    // Έλεγχος αν υπάρχει ήδη αυτό το route
                    if (!this.routeExists(router.routingTable, wanRoute)) {
                        router.routingTable.push(wanRoute);
                        newRoutes.push(wanRoute);
                    }
                }
            }
            
            // 2. Προσθήκη routes για τα connected δίκτυα
            const deviceManager = window.deviceManager;
            if (deviceManager) {
                // Βρες όλες τις συσκευές που είναι connected με αυτόν τον router
                const connectedDevices = [];
                this.connections.forEach(conn => {
                    if (conn.device1Id === router.id) {
                        const device = deviceManager.getDeviceById(conn.device2Id);
                        if (device) connectedDevices.push(device);
                    } else if (conn.device2Id === router.id) {
                        const device = deviceManager.getDeviceById(conn.device1Id);
                        if (device) connectedDevices.push(device);
                    }
                });
                
                console.log(`[AUTO ROUTES] Connected devices to ${router.name}:`, connectedDevices.map(d => d.name));
                
                // Για κάθε connected συσκευή, πρόσθεσε routes
                connectedDevices.forEach(device => {
                    if (device.ip && device.ip !== 'N/A' && device.subnetMask) {
                        const network = this.getNetworkFromIP(device.ip, device.subnetMask);
                        const route = {
                            network: network,
                            mask: device.subnetMask,
                            gateway: device.ip, // Χρησιμοποιούμε τη συσκευή ως gateway
                            interface: this.getInterfaceForDevice(router, device),
                            metric: 1
                        };
                        
                        // Έλεγχος αν υπάρχει ήδη αυτό το route
                        if (!this.routeExists(router.routingTable, route)) {
                            router.routingTable.push(route);
                            newRoutes.push(route);
                        }
                    }
                });
            }
            
            // 3. Προσθήκη default route αν χρειάζεται
            if (router.interfaces.wan.gateway && router.interfaces.wan.gateway !== '0.0.0.0') {
                const defaultRoute = {
                    network: '0.0.0.0',
                    mask: '0.0.0.0',
                    gateway: router.interfaces.wan.gateway,
                    interface: 'wan',
                    metric: 10
                };
                
                if (!this.routeExists(router.routingTable, defaultRoute)) {
                    router.routingTable.push(defaultRoute);
                    newRoutes.push(defaultRoute);
                }
            }
            
            console.log(`[AUTO ROUTES] Δημιουργήθηκαν ${newRoutes.length} νέα routes για τον ${router.name}`);
            return newRoutes;
            
        } catch (error) {
            console.error('[AUTO ROUTES] Σφάλμα:', error);
            return [];
        }
    }

    // Βοηθητική μέθοδος για υπολογισμό network address από IP και subnet mask
    getNetworkFromIP(ip, subnetMask) {
        if (!ip || ip === 'N/A') return '0.0.0.0';
        
        try {
            const ipParts = ip.split('.').map(Number);
            const maskParts = subnetMask.split('.').map(Number);
            
            const networkParts = ipParts.map((part, i) => part & maskParts[i]);
            return networkParts.join('.');
        } catch (error) {
            console.error(`[AUTO ROUTES] Σφάλμα υπολογισμού network από ${ip}/${subnetMask}:`, error);
            return ip.split('.').slice(0, 3).concat(['0']).join('.');
        }
    }

    // Βοηθητική μέθοδος για έλεγχο ύπαρξης route
    routeExists(routingTable, route) {
        return routingTable.some(existingRoute => 
            existingRoute.network === route.network &&
            existingRoute.mask === route.mask &&
            existingRoute.gateway === route.gateway
        );
    }

    // Βοηθητική μέθοδος για προσδιορισμό interface
    getInterfaceForDevice(router, device) {
        // Προσδιορισμός interface βάσει των IP ranges
        if (router.interfaces.lan.ip && device.ip) {
            const lanNetwork = this.getNetworkFromIP(router.interfaces.lan.ip, router.interfaces.lan.subnetMask || '255.255.255.0');
            const deviceNetwork = this.getNetworkFromIP(device.ip, device.subnetMask || '255.255.255.0');
            
            if (lanNetwork === deviceNetwork) {
                return 'lan';
            }
        }
        
        if (router.interfaces.wan.ip && device.ip) {
            const wanNetwork = this.getNetworkFromIP(router.interfaces.wan.ip, router.interfaces.wan.subnetMask || '255.255.255.0');
            const deviceNetwork = this.getNetworkFromIP(device.ip, device.subnetMask || '255.255.255.0');
            
            if (wanNetwork === deviceNetwork) {
                return 'wan';
            }
        }
        
        // Default: lan
        return 'lan';
    }
    
    // ΝΕΑ ΜΕΘΟΔΟΣ: Προσθήκη αυτόματων routes για router σύνδεση
    addAutoRoutesForRouterConnection(router1, router2, interface1, interface2) {
        console.log(`[AUTO ROUTER ROUTES] Προσθήκη routes για: ${router1.name} (${interface1}) ↔ ${router2.name} (${interface2})`);
        
        // Δημιουργία routing tables αν λείπουν
        if (!router1.routingTable) router1.routingTable = [];
        if (!router2.routingTable) router2.routingTable = [];
        
        // Ανάλογα με τη σύνδεση, προσθέτουμε τα αντίστοιχα routes
        
        if (interface1 === 'lan' && interface2 === 'wan') {
            // Router1 LAN ↔ Router2 WAN
            // Router2 πρέπει να μάθει το δίκτυο του Router1 μέσω WAN
            if (router1.interfaces.lan.ip && router1.interfaces.lan.ip !== 'N/A') {
                const router1Network = this.getNetworkFromIP(router1.interfaces.lan.ip, router1.interfaces.lan.subnetMask);
                
                router2.routingTable.push({
                    network: router1Network,
                    mask: router1.interfaces.lan.subnetMask,
                    gateway: router2.interfaces.wan.gateway || router2.interfaces.wan.ip,
                    interface: 'wan',
                    metric: 1
                });
                
                console.log(`[AUTO ROUTER ROUTES] Προστέθηκε route στο ${router2.name}: ${router1Network}/${router1.interfaces.lan.subnetMask} → ${router2.interfaces.wan.gateway || router2.interfaces.wan.ip}`);
            }
        }
        else if (interface1 === 'wan' && interface2 === 'lan') {
            // Router1 WAN ↔ Router2 LAN
            // Router1 πρέπει να μάθει το δίκτυο του Router2 μέσω WAN
            if (router2.interfaces.lan.ip && router2.interfaces.lan.ip !== 'N/A') {
                const router2Network = this.getNetworkFromIP(router2.interfaces.lan.ip, router2.interfaces.lan.subnetMask);
                
                router1.routingTable.push({
                    network: router2Network,
                    mask: router2.interfaces.lan.subnetMask,
                    gateway: router1.interfaces.wan.gateway || router1.interfaces.wan.ip,
                    interface: 'wan',
                    metric: 1
                });
                
                console.log(`[AUTO ROUTER ROUTES] Προστέθηκε route στο ${router1.name}: ${router2Network}/${router2.interfaces.lan.subnetMask} → ${router1.interfaces.wan.gateway || router1.interfaces.wan.ip}`);
            }
        }
        
        // Ενημέρωση UI αν χρειάζεται
        if (window.uiManager) {
            setTimeout(() => {
                if (router1 === window.deviceManager.selectedDevice) {
                    window.uiManager.updateDeviceInfo(router1);
                }
                if (router2 === window.deviceManager.selectedDevice) {
                    window.uiManager.updateDeviceInfo(router2);
                }
            }, 100);
        }
    }
}

// Εξαγωγή της κλάσης
export default ConnectionManager;
