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
            if (device.connectionInterfaces) {
                for (const [connId, interfaceType] of Object.entries(device.connectionInterfaces)) {
                    if (interfaceType === 'lan') return device.interfaces.lan.ip;
                    if (interfaceType === 'lan2') return device.interfaces.lan2.ip;
                    if (interfaceType === 'wan') return device.interfaces.wan.ip;
                }
            }
            return device.interfaces.lan.ip;
        }
        return device.ip;
    }    
    
    getDeviceSubnet(device) {
        if (!device) return '255.255.255.0';
        if (device.type === 'router') {
            return device.interfaces?.lan?.subnetMask || device.interfaces?.wan?.subnetMask || '255.255.255.0';
        }
        return device.subnetMask || '255.255.255.0';
    }
    
    getDeviceGateway(device) {
        if (!device) return null;
        if (device.type === 'router') {
            return device.interfaces?.wan?.gateway;
        }
        return device.gateway;
    }
    
    getDeviceDNS(device) {
        if (!device) return [];
        if (device.type === 'router') {
            return device.interfaces?.lan?.dns || device.interfaces?.wan?.dns || [];
        }
        return device.dns || [];
    }
    
    isExternalIP(ip) {
        if (!ip || ip === 'N/A') return false;
        
        const privateRanges = [
            /^10\./,                        // 10.0.0.0/8
            /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // 172.16.0.0/12
            /^192\.168\./,                  // 192.168.0.0/16
            /^127\./,                       // Loopback
            /^169\.254\./,                  // Link-local
            /^203\.0\.113\./                // TEST-NET-3
        ];
        
        const isPrivate = privateRanges.some(regex => regex.test(ip));
        return !isPrivate;
    }
    
    routerHasInternetAccess(router) {
        if (!router || router.type !== 'router') return false;
        
        const wanIP = router.interfaces?.wan?.ip;
        const wanGateway = router.interfaces?.wan?.gateway;
        
        return wanIP && wanIP !== 'N/A' && wanIP !== '0.0.0.0' &&
               wanGateway && wanGateway !== '0.0.0.0' && wanGateway !== 'N/A';
    }
    
    // ==================== ΝΕΕΣ ΒΟΗΘΗΤΙΚΕΣ ΣΥΝΑΡΤΗΣΕΙΣ ΓΙΑ ROUTERS ====================
    
    getInterfaceForRouterConnection(router, otherRouter) {
        console.log(`[ROUTER INTERFACE] Προσδιορισμός interface για ${router.name} ↔ ${otherRouter.name}`);
        
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
        
        const routerLanIP = router.interfaces.lan.ip;
        const otherLanIP = otherRouter.interfaces.lan.ip;
        const routerWanIP = router.interfaces.wan.ip;
        const otherWanIP = otherRouter.interfaces.wan.ip;
        
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
        
        console.log(`[ROUTER INTERFACE] Default: LAN interface`);
        return 'lan';
    }
    
    assignRouterWanIP(router, otherRouter) {
        console.log(`[ROUTER WAN IP] Ανάθεση WAN IP για ${router.name} που συνδέεται με ${otherRouter.name}`);
        
        if (router.interfaces.wan.ip && router.interfaces.wan.ip !== 'N/A' && router.interfaces.wan.ip !== '0.0.0.0') {
            console.log(`[ROUTER WAN IP] Έχει ήδη WAN IP: ${router.interfaces.wan.ip}`);
            return router.interfaces.wan.ip;
        }
        
        const otherLanIP = otherRouter.interfaces.lan.ip;
        if (otherLanIP && otherLanIP !== 'N/A' && otherLanIP !== '0.0.0.0') {
            const ipParts = otherLanIP.split('.');
            
            for (let i = 2; i < 255; i++) {
                ipParts[3] = i.toString();
                const potentialIP = ipParts.join('.');
                
                const existingDevice = window.deviceManager?.getDeviceByIP(potentialIP);
                if (!existingDevice || existingDevice.id === router.id) {
                    router.interfaces.wan.ip = potentialIP;
                    router.interfaces.wan.subnetMask = otherRouter.interfaces.lan.subnetMask || '255.255.255.0';
                    router.interfaces.wan.gateway = otherLanIP;
                    
                    console.log(`[ROUTER WAN IP] Ορίστηκε WAN IP: ${potentialIP}, Gateway: ${otherLanIP}`);
                    
                    if (router.element && router.element.querySelector('.device-ip')) {
                        router.element.querySelector('.device-ip').innerHTML = 
                            `WAN: ${potentialIP}<br>LAN: ${router.interfaces.lan.ip}`;
                    }
                    
                    return potentialIP;
                }
            }
        }
        
        router.interfaces.wan.ip = '192.168.1.6';
        router.interfaces.wan.subnetMask = '255.255.255.0';
        router.interfaces.wan.gateway = '192.168.1.1';
        
        console.log(`[ROUTER WAN IP] Fallback WAN IP: 192.168.1.6`);
        return '192.168.1.6';
    }
    
    // ==================== ΒΟΗΘΗΤΙΚΗ ΜΕΘΟΔΟΣ ΓΙΑ ΕΛΕΓΧΟ ΧΡΗΣΙΜΟΠΟΙΗΜΕΝΩΝ INTERFACES ====================
    
getActuallyUsedRouterInterfaces(router) {
    const usedInterfaces = new Set();
    
    console.log(`[USED INTERFACES] Έλεγχος για router: ${router.name}`);
    
    // Έλεγχος από τις πραγματικές συνδέσεις
    this.connections.forEach(conn => {
        if (conn.device1Id === router.id || conn.device2Id === router.id) {
            let interfaceUsed = null;
            
            if (conn.device1Id === router.id && conn.interface1) {
                interfaceUsed = conn.interface1;
            }
            else if (conn.device2Id === router.id && conn.interface2) {
                interfaceUsed = conn.interface2;
            }
            
            if (interfaceUsed) {
                usedInterfaces.add(interfaceUsed);
                console.log(`[USED INTERFACES] Χρησιμοποιείται interface: ${interfaceUsed} από σύνδεση ${conn.id}`);
            }
        }
    });
    
    console.log(`[USED INTERFACES] Router ${router.name}: Χρησιμοποιούνται: ${Array.from(usedInterfaces).join(', ')}`);
    return usedInterfaces;
}
    
    // Βοηθητική μέθοδος για προσδιορισμό interface από σύνδεση - ΒΕΛΤΙΩΜΕΝΗ
    determineInterfaceForConnection(router, connection) {
        console.log(`[INTERFACE DETECT] Έλεγχος interface για: ${router.name}, Σύνδεση: ${connection.id}`);
        
        // 1. Έλεγχος αν υπάρχει ήδη στη σύνδεση
        if (connection.device1Id === router.id && connection.interface1) {
            console.log(`[INTERFACE DETECT] Βρέθηκε ήδη στη σύνδεση: ${connection.interface1}`);
            return connection.interface1;
        }
        if (connection.device2Id === router.id && connection.interface2) {
            console.log(`[INTERFACE DETECT] Βρέθηκε ήδη στη σύνδεση: ${connection.interface2}`);
            return connection.interface2;
        }
        
        // 2. Έλεγχος στο router.connectionInterfaces
        if (router.connectionInterfaces && router.connectionInterfaces[connection.id]) {
            const storedInterface = router.connectionInterfaces[connection.id];
            console.log(`[INTERFACE DETECT] Βρέθηκε στο connectionInterfaces: ${storedInterface}`);
            return storedInterface;
        }
        
        // 3. Βρες την άλλη συσκευή
        const otherDeviceId = connection.device1Id === router.id ? connection.device2Id : conn.device1Id;
        const otherDevice = window.deviceManager.getDeviceById(otherDeviceId);
        
        if (!otherDevice) {
            console.log(`[INTERFACE DETECT] Δεν βρέθηκε άλλη συσκευή για σύνδεση ${connection.id}`);
            return 'lan'; // default
        }
        
        console.log(`[INTERFACE DETECT] Έλεγχος interface για σύνδεση: ${router.name} ↔ ${otherDevice.name}`);
        
        // 4. Έλεγχος αν είναι router-to-router σύνδεση
        if (otherDevice.type === 'router') {
            console.log(`[INTERFACE DETECT] Router-to-router σύνδεση`);
            return this.getInterfaceForRouterConnection(router, otherDevice);
        }
        
        // 5. Για άλλες συσκευές, ελέγχουμε αν είναι στο ίδιο δίκτυο
        const routerLanIP = router.interfaces.lan.ip;
        const routerSubnet = router.interfaces.lan.subnetMask;
        const otherIP = this.getDeviceIP(otherDevice);
        const otherSubnet = this.getDeviceSubnet(otherDevice);
        
        console.log(`[INTERFACE DETECT] Router LAN: ${routerLanIP}/${routerSubnet}, Other: ${otherIP}/${otherSubnet}`);
        
        if (routerLanIP && routerLanIP !== 'N/A' && otherIP && otherIP !== 'N/A') {
            if (areInSameNetwork(routerLanIP, otherIP, routerSubnet, otherSubnet)) {
                console.log(`[INTERFACE DETECT] Είναι στο ίδιο δίκτυο -> LAN interface`);
                return 'lan';
            }
        }
        
        // 6. Έλεγχος για WAN
        const routerWanIP = router.interfaces.wan.ip;
        const routerWanSubnet = router.interfaces.wan.subnetMask;
        
        if (routerWanIP && routerWanIP !== 'N/A' && otherIP && otherIP !== 'N/A') {
            if (areInSameNetwork(routerWanIP, otherIP, routerWanSubnet, otherSubnet)) {
                console.log(`[INTERFACE DETECT] Είναι στο ίδιο δίκτυο WAN -> WAN interface`);
                return 'wan';
            }
        }
        
        // 7. Ελέγχουμε για LAN2
        if (router.interfaces.lan2 && router.interfaces.lan2.enabled) {
            const routerLan2IP = router.interfaces.lan2.ip;
            const routerLan2Subnet = router.interfaces.lan2.subnetMask;
            
            if (routerLan2IP && routerLan2IP !== 'N/A' && otherIP && otherIP !== 'N/A') {
                if (areInSameNetwork(routerLan2IP, otherIP, routerLan2Subnet, otherSubnet)) {
                    console.log(`[INTERFACE DETECT] Είναι στο ίδιο δίκτυο LAN2 -> LAN2 interface`);
                    return 'lan2';
                }
            }
        }
        
        console.log(`[INTERFACE DETECT] Δεν μπορούσαμε να προσδιορίσουμε, default: lan`);
        return 'lan'; // default
    }
    
    // ==================== ΒΟΗΘΗΤΙΚΗ ΜΕΘΟΔΟΣ ΓΙΑ ΔΙΑΘΕΣΙΜΑ INTERFACES ====================
    
getFreeRouterInterfaces(router) {
    console.log(`[FREE INTERFACES] Έλεγχος για router: ${router.name}`);
    
    const allInterfaces = [];
    
    // Προσθήκη ΔΙΑΘΕΣΙΜΩΝ interfaces
    if (router.interfaces.lan && router.interfaces.lan.ip !== 'N/A') {
        allInterfaces.push('lan');
        console.log(`[FREE INTERFACES] LAN διαθέσιμο: ${router.interfaces.lan.ip}`);
    }
    
    if (router.interfaces.lan2 && 
        router.interfaces.lan2.ip !== 'N/A' && 
        router.interfaces.lan2.enabled) {
        allInterfaces.push('lan2');
        console.log(`[FREE INTERFACES] LAN2 διαθέσιμο: ${router.interfaces.lan2.ip}`);
    }
    
    // ΠΡΟΣΟΧΗ: Το WAN είναι ΠΑΝΤΑ διαθέσιμο για σύνδεση, ακόμα και αν δεν έχει IP!
    // Μπορούμε να του δώσουμε IP όταν συνδεθεί
    if (router.interfaces.wan) {
        allInterfaces.push('wan');
        console.log(`[FREE INTERFACES] WAN διαθέσιμο (τώρα: ${router.interfaces.wan.ip || 'N/A'})`);
    }
    
    console.log(`[FREE INTERFACES] Όλα τα διαθέσιμα interfaces: ${allInterfaces.join(', ')}`);
    
    // Βρες τα ΧΡΗΣΙΜΟΠΟΙΗΜΕΝΑ interfaces
    const usedInterfaces = this.getActuallyUsedRouterInterfaces(router);
    
    // Φίλτραρε τα ελεύθερα interfaces
    const freeInterfaces = allInterfaces.filter(iface => !usedInterfaces.has(iface));
    
    console.log(`[FREE INTERFACES] ${router.name}: Διαθέσιμα: ${allInterfaces}, Χρησιμοποιημένα: ${Array.from(usedInterfaces)}, Ελεύθερα: ${freeInterfaces}`);
    
    return freeInterfaces;
}
    
    // ==================== ΚΥΡΙΕΣ ΜΕΘΟΔΟΙ ====================

canAcceptConnection(device, requestedInterface = null) {
    console.log('[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Έλεγχος:', device?.name, device?.type, 'Interface:', requestedInterface);

    if (!device) {
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ΑΠΟΡΡΙΦΘΗΚΕ: Δεν βρέθηκε η συσκευή.`);
        return false;
    }

    // 1. Switches - απεριόριστες συνδέσεις
    if (device.type === 'switch') {
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} (switch): Απεριόριστες συνδέσεις ✓`);
        return true;
    }

    // 2. Routers - ΜΕΓΙΣΤΟ 3 ΣΥΝΔΕΣΕΙΣ ΣΥΝΟΛΙΚΑ
    if (device.type === 'router') {
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} (router): Έλεγχος...`);
        
        // ΜΕΤΡΗΣΕ ΠΡΑΓΜΑΤΙΚΕΣ ΣΥΝΔΕΣΕΙΣ
        const currentConns = this.connections.filter(conn => 
            conn.device1Id === device.id || conn.device2Id === device.id
        ).length;
        
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} έχει ${currentConns} συνδέσεις`);
        
        // ΜΕΓΙΣΤΟ 3 ΣΥΝΔΕΣΕΙΣ ΟΛΟΚΛΗΡΟ
        if (currentConns >= 3) {
            console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name}: Ήδη έχει ${currentConns}/3 συνδέσεις ✗`);
            return false;
        }
        
        // Αν ζητήθηκε συγκεκριμένο interface, έλεγξε αν είναι διαθέσιμο
        if (requestedInterface) {
            const freeInterfaces = this.getFreeRouterInterfaces(device);
            const isAvailable = freeInterfaces.includes(requestedInterface);
            
            console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] Ελεύθερα interfaces: ${freeInterfaces.join(', ')}, Ζητούμενο: ${requestedInterface}, Διαθέσιμο: ${isAvailable}`);
            
            return isAvailable;
        }
        
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} μπορεί να δεχτεί σύνδεση ✓`);
        return true;
    }

    // 3. Όλες οι άλλες συσκευές - μόνο 1 σύνδεση
    const currentConns = this.connections.filter(conn => 
        conn.device1Id === device.id || conn.device2Id === device.id
    ).length;

    console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} (${device.type}): ${currentConns} συνδέσεις`);

    if (currentConns < 1) {
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} μπορεί να δεχτεί σύνδεση ✓`);
        return true;
    } else {
        console.log(`[ΣΥΝΔΕΣΙΜΟΤΗΤΑ] ${device.name} δεν μπορεί να δεχτεί άλλη σύνδεση ✗`);
        return false;
    }
}
    // ==================== ΜΕΘΟΔΟΣ ΔΗΜΙΟΥΡΓΙΑΣ ROUTER-TO-ROUTER ΣΥΝΔΕΣΗΣ ====================
    
    createRouterToRouterConnection(router1, router2) {
        console.log(`[ROUTER↔ROUTER] Δημιουργία σύνδεσης: ${router1.name} ↔ ${router2.name}`);
        
        // ΑΠΛΟΣ ΕΛΕΓΧΟΣ: Μπορούν να δεχτούν σύνδεση;
        const can1 = this.canAcceptConnection(router1);
        const can2 = this.canAcceptConnection(router2);
        
        if (!can1 || !can2) {
            console.log(`[ROUTER↔ROUTER] ΑΠΟΡΡΙΦΘΗΚΕ: Ένας router δεν μπορεί να δεχτεί σύνδεση`);
            if (window.uiManager) {
                window.uiManager.addLog(`Ο router δεν μπορεί να δεχτεί σύνδεση (όχι ελεύθερα interfaces)`, "error");
            }
            return null;
        }
        
        // Έλεγχος για ύπαρξη ήδη σύνδεσης
        const existingConnection = this.connections.find(conn => 
            (conn.device1Id === router1.id && conn.device2Id === router2.id) ||
            (conn.device1Id === router2.id && conn.device2Id === router1.id)
        );
        
        if (existingConnection) {
            console.log(`[ROUTER↔ROUTER] Οι routers είναι ήδη συνδεδεμένοι`);
            if (window.uiManager) {
                window.uiManager.addLog(`Οι routers είναι ήδη συνδεδεμένοι`, "warning");
            }
            return existingConnection;
        }
        
        // Λήψη ελεύθερων interfaces ΚΑΙ ΤΩΡΑ ΚΑΝΟΥΜΕ ΑΠΛΟ ΕΛΕΓΧΟ
        const freeInterfaces1 = this.getFreeRouterInterfaces(router1);
        const freeInterfaces2 = this.getFreeRouterInterfaces(router2);
        
        console.log(`[ROUTER↔ROUTER] Ελεύθερα interfaces: ${router1.name}: ${freeInterfaces1}, ${router2.name}: ${freeInterfaces2}`);
        
        // ΑΠΛΟΣ ΕΛΕΓΧΟΣ: Υπάρχουν ελεύθερα interfaces;
        if (freeInterfaces1.length === 0) {
            alert(`Ο router ${router1.name} δεν έχει ελεύθερα interfaces!`);
            return null;
        }
        if (freeInterfaces2.length === 0) {
            alert(`Ο router ${router2.name} δεν έχει ελεύθερα interfaces!`);
            return null;
        }
        
        // ΑΠΛΗ ΕΠΙΛΟΓΗ ΧΩΡΙΣ ΠΕΡΙΣΣΕΣ ΛΟΓΙΚΕΣ
        let optionsText = `Σύνδεση Router ↔ Router:\n\n`;
        optionsText += `${router1.name} ↔ ${router2.name}\n\n`;
        optionsText += `Επιλογή interface για ${router1.name}:\n`;
        
        freeInterfaces1.forEach((iface, index) => {
            let ipInfo = '';
            switch(iface) {
                case 'lan': ipInfo = `LAN (${router1.interfaces.lan.ip})`; break;
                case 'lan2': ipInfo = `LAN2 (${router1.interfaces.lan2.ip})`; break;
                case 'wan': ipInfo = `WAN (${router1.interfaces.wan.ip || 'Θα δημιουργηθεί'})`; break;
            }
            optionsText += `${index + 1}. ${iface.toUpperCase()} - ${ipInfo}\n`;
        });
        
        optionsText += `\nΕισάγετε αριθμό (1-${freeInterfaces1.length}):`;
        
        const interfaceChoice = prompt(optionsText, "1");
        const choiceIndex = parseInt(interfaceChoice) - 1;
        
        // ΑΠΛΟΣ ΕΛΕΓΧΟΣ: Επιλογή χρήστη
        if (choiceIndex >= 0 && choiceIndex < freeInterfaces1.length) {
            const interface1 = freeInterfaces1[choiceIndex];
            
            // Τώρα επιλογή για τον δεύτερο router
            let optionsText2 = `Επιλογή interface για ${router2.name}:\n\n`;
            
            freeInterfaces2.forEach((iface, index) => {
                let ipInfo = '';
                switch(iface) {
                    case 'lan': ipInfo = `LAN (${router2.interfaces.lan.ip})`; break;
                    case 'lan2': ipInfo = `LAN2 (${router2.interfaces.lan2.ip})`; break;
                    case 'wan': ipInfo = `WAN (${router2.interfaces.wan.ip || 'Θα δημιουργηθεί'})`; break;
                }
                optionsText2 += `${index + 1}. ${iface.toUpperCase()} - ${ipInfo}\n`;
            });
            
            optionsText2 += `\nΕισάγετε αριθμό (1-${freeInterfaces2.length}):`;
            
            const interfaceChoice2 = prompt(optionsText2, "1");
            const choiceIndex2 = parseInt(interfaceChoice2) - 1;
            
            if (choiceIndex2 >= 0 && choiceIndex2 < freeInterfaces2.length) {
                const interface2 = freeInterfaces2[choiceIndex2];
                
                console.log(`[ROUTER↔ROUTER] Επιλέχθηκαν: ${router1.name}(${interface1}) ↔ ${router2.name}(${interface2})`);
                
                // ΚΑΝΟΥΜΕ ΤΗΝ ΣΥΝΔΕΣΗ ΚΑΙ ΑΝ ΕΙΝΑΙ ΛΑΝ ↔ ΛΑΝ ΜΕ ΗΔΗ CLOUD ΣΤΟ WAN
                // ΑΛΛΑ ΑΦΗΝΟΥΜΕ ΤΟΝ ΧΡΗΣΤΗ ΝΑ ΑΠΟΦΑΣΙΣΕΙ
                return this.createRouterToRouterConnectionWithInterfaces(router1, router2, interface1, interface2);
            }
        }
        
        console.log(`[ROUTER↔ROUTER] Ακυρη επιλογή. Ακύρωση.`);
        return null;
    }
    
    // ΔΙΟΡΘΩΜΕΝΗ ΜΕΘΟΔΟΣ: Κάνει ακριβώς αυτό που ζητάει ο χρήστης
    createRouterToRouterConnectionWithInterfaces(router1, router2, interface1, interface2) {
        console.log(`[ROUTER↔ROUTER] Δημιουργία: ${router1.name}(${interface1}) ↔ ${router2.name}(${interface2})`);
        
        // ΑΠΛΟΣ ΕΛΕΓΧΟΣ: Μπορούν να δεχτούν σύνδεση στα συγκεκριμένα interfaces;
        const can1 = this.canAcceptConnection(router1, interface1);
        const can2 = this.canAcceptConnection(router2, interface2);
        
        if (!can1 || !can2) {
            console.log(`[ROUTER↔ROUTER] Απόρριψη: Το interface δεν είναι διαθέσιμο`);
            alert(`Το ${interface1.toUpperCase()} του ${router1.name} ή το ${interface2.toUpperCase()} του ${router2.name} δεν είναι διαθέσιμο!`);
            return null;
        }
        
        // ΑΠΛΟΣ ΕΛΕΓΧΟΣ: WAN που έχει ήδη Cloud
        if (interface1 === 'wan') {
            const hasCloudOnWAN1 = this.doesRouterHaveDeviceOnInterface(router1, 'wan', 'cloud');
            if (hasCloudOnWAN1) {
                const choice = confirm(`Ο ${router1.name} έχει ήδη Cloud στο WAN!\n\nΘέλετε να συνεχίσετε με αυτή τη σύνδεση;`);
                if (!choice) return null;
            }
        }
        
        if (interface2 === 'wan') {
            const hasCloudOnWAN2 = this.doesRouterHaveDeviceOnInterface(router2, 'wan', 'cloud');
            if (hasCloudOnWAN2) {
                const choice = confirm(`Ο ${router2.name} έχει ήδη Cloud στο WAN!\n\nΘέλετε να συνεχίσετε με αυτή τη σύνδεση;`);
                if (!choice) return null;
            }
        }
        
        // ΑΠΛΗ ΔΗΜΙΟΥΡΓΙΑ ΣΥΝΔΕΣΗΣ
        const connection = this.createBasicConnection(router1, router2);
        
        if (connection) {
            // ΑΠΛΗ ΑΠΟΘΗΚΕΥΣΗ
            if (!router1.connectionInterfaces) router1.connectionInterfaces = {};
            if (!router2.connectionInterfaces) router2.connectionInterfaces = {};
            
            router1.connectionInterfaces[connection.id] = interface1;
            router2.connectionInterfaces[connection.id] = interface2;
            
            connection.interface1 = interface1;
            connection.interface2 = interface2;
            
            console.log(`[ROUTER↔ROUTER] Δημιουργήθηκε: ${router1.name} (${interface1}) ↔ ${router2.name} (${interface2})`);
            
            // ΑΝΑΘΕΣΗ IP ΜΟΝΟ ΑΝ ΧΡΕΙΑΖΕΤΑΙ
            if (interface1 === 'wan' && (!router1.interfaces.wan.ip || router1.interfaces.wan.ip === 'N/A')) {
                this.assignRouterWanIP(router1, router2);
            }
            if (interface2 === 'wan' && (!router2.interfaces.wan.ip || router2.interfaces.wan.ip === 'N/A')) {
                this.assignRouterWanIP(router2, router1);
            }
            
            // ΠΡΟΣΘΗΚΗ ROUTES ΑΠΛΑ
            this.addSimpleRoutesForRouterConnection(router1, router2, interface1, interface2);
            
            if (window.uiManager) {
                window.uiManager.addLog(`Δημιουργήθηκε σύνδεση: ${router1.name} (${interface1}) ↔ ${router2.name} (${interface2})`, 'success');
            }
        }
        
        return connection;
    }
    
    // ΝΕΑ ΒΟΗΘΗΤΙΚΗ: Έλεγχος αν router έχει συγκεκριμένη συσκευή σε interface
    doesRouterHaveDeviceOnInterface(router, interfaceType, deviceType) {
        if (!router.connectionInterfaces) return false;
        
        for (const [connId, iface] of Object.entries(router.connectionInterfaces)) {
            if (iface === interfaceType) {
                const conn = this.connections.find(c => c.id === connId);
                if (conn) {
                    const otherId = conn.device1Id === router.id ? conn.device2Id : conn.device1Id;
                    const otherDevice = window.deviceManager.getDeviceById(otherId);
                    if (otherDevice && otherDevice.type === deviceType) {
                        return true;
                    }
                }
            }
        }
        return false;
    }
    
    // ΑΠΛΗ ΜΕΘΟΔΟΣ ΓΙΑ ROUTES
    addSimpleRoutesForRouterConnection(router1, router2, interface1, interface2) {
        console.log(`[SIMPLE ROUTES] Προσθήκη routes για: ${router1.name} (${interface1}) ↔ ${router2.name} (${interface2})`);
        
        if (!router1.routingTable) router1.routingTable = [];
        if (!router2.routingTable) router2.routingTable = [];
        
        // ΑΠΛΗ ΛΟΓΙΚΗ: LAN ↔ WAN
        if (interface1 === 'lan' && interface2 === 'wan') {
            // Router2 μπορεί να φτάσει το LAN του Router1 μέσω WAN
            const router1LAN = this.getNetworkFromIP(router1.interfaces.lan.ip, router1.interfaces.lan.subnetMask);
            router2.routingTable.push({
                network: router1LAN,
                mask: router1.interfaces.lan.subnetMask,
                gateway: router2.interfaces.wan.ip,
                interface: 'wan'
            });
        }
        
        if (interface1 === 'wan' && interface2 === 'lan') {
            // Router1 μπορεί να φτάσει το LAN του Router2 μέσω WAN
            const router2LAN = this.getNetworkFromIP(router2.interfaces.lan.ip, router2.interfaces.lan.subnetMask);
            router1.routingTable.push({
                network: router2LAN,
                mask: router2.interfaces.lan.subnetMask,
                gateway: router1.interfaces.wan.ip,
                interface: 'wan'
            });
        }
    }
    
    // ==================== ΜΕΘΟΔΟΙ ΔΗΜΙΟΥΡΓΙΑΣ ΣΥΝΔΕΣΕΩΝ ====================
    
    // Βασική μέθοδος δημιουργίας σύνδεσης
    createBasicConnection(device1, device2) {
        console.log(`[BASIC CONNECTION] Δημιουργία: ${device1.name} ↔ ${device2.name}`);
        
        const can1 = this.canAcceptConnection(device1);
        const can2 = this.canAcceptConnection(device2);
        
        if (!can1 || !can2) {
            console.log(`[BASIC CONNECTION] Απορρίφθηκε: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`);
            if (window.uiManager) {
                window.uiManager.addLog(`Σφάλμα: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`, "error");
            }
            return null;
        }
        
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
        
        const connection = {
            id: 'conn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            device1Id: device1.id,
            device2Id: device2.id,
            type: 'direct',
            canCommunicate: true,
            timestamp: new Date().toISOString()
        };
        
        this.connections.push(connection);
        
        if (!device1.connections) device1.connections = [];
        if (!device2.connections) device2.connections = [];
        
        device1.connections.push(connection.id);
        device2.connections.push(connection.id);
        
        
        const communication = this.canDevicesCommunicateDirectly(device1, device2);
        connection.canCommunicate = communication.canCommunicate;
        connection.type = communication.viaGateway ? 'routed' : 'direct';
        
        console.log(`[BASIC CONNECTION] Δημιουργήθηκε: ${device1.name} ↔ ${device2.name} (${connection.canCommunicate ? 'ΕΠΙΚΟΙΝΩΝΙΑ ΔΥΝΑΤΗ' : 'ΧΩΡΙΣ ΕΠΙΚΟΙΝΩΝΙΑ'})`);
        
        if (window.uiManager) {
            window.uiManager.addLog(`Δημιουργήθηκε σύνδεση: ${device1.name} ↔ ${device2.name}`, 'success');
            this.updateConnectionsVisual();
        }
        
        return connection;
    }

createConnection(device1, device2) {
    console.log(`[ΣΥΝΔΕΣΗ] Έλεγχος: ${device1.name} (${device1.type}) ↔ ${device2.name} (${device2.type})`);
    
    // 1. Router ↔ Router
    if (device1.type === 'router' && device2.type === 'router') {
        return this.createRouterToRouterConnection(device1, device2);
    }
    
    // 2. Router ↔ Όποια άλλη συσκευή (Cloud, Server, Computer, κλπ.)
    if ((device1.type === 'router' && device2.type !== 'router') || 
        (device2.type === 'router' && device1.type !== 'router')) {
        
        // Βοήθεια: Βρείτε ποιος είναι ο router
        const router = device1.type === 'router' ? device1 : device2;
        const otherDevice = device1.type === 'router' ? device2 : device1;
        
        console.log(`[ROUTER-DEVICE] Σύνδεση: ${router.name} ↔ ${otherDevice.name} (${otherDevice.type})`);
        return this.createRouterToDeviceConnection(router, otherDevice);
    }
    
    // 3. Οι υπόλοιπες συνδέσεις (χωρίς router)
    return this.createBasicConnection(device1, device2);
}
    
    // Σύνδεση Router ↔ Όποια άλλη συσκευή
createRouterToDeviceConnection(router, otherDevice) {
    console.log(`[ROUTER-DEVICE] Δημιουργία σύνδεσης: ${router.name} ↔ ${otherDevice.name}`);
    
    // Έλεγχος αν μπορούν να δεχτούν σύνδεση
    const can1 = this.canAcceptConnection(router);
    const can2 = this.canAcceptConnection(otherDevice);
    
    if (!can1 || !can2) {
        console.log(`[ROUTER-DEVICE] ΑΠΟΡΡΙΦΘΗΚΕ: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`);
        if (window.uiManager) {
            window.uiManager.addLog(`Σφάλμα: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`, "error");
        }
        return null;
    }
    
    // Έλεγχος για ύπαρξη σύνδεσης
    const existingConnection = this.connections.find(conn => 
        (conn.device1Id === router.id && conn.device2Id === otherDevice.id) ||
        (conn.device1Id === otherDevice.id && conn.device2Id === router.id)
    );
    
    if (existingConnection) {
        console.log(`[ROUTER-DEVICE] Οι συσκευές είναι ήδη συνδεδεμένες`);
        if (window.uiManager) {
            window.uiManager.addLog(`Οι συσκευές είναι ήδη συνδεδεμένες`, "warning");
        }
        return existingConnection;
    }
    
    // Βρες τα ελεύθερα interfaces του router
    const freeInterfaces = this.getFreeRouterInterfaces(router);
    
    console.log(`[ROUTER-DEVICE] Router ${router.name}: Ελεύθερα interfaces: ${freeInterfaces.join(', ')}`);
    
    if (freeInterfaces.length === 0) {
        alert(`Ο router ${router.name} δεν έχει ελεύθερα interfaces!`);
        console.log(`[ROUTER-DEVICE] Router ${router.name} δεν έχει ελεύθερα interfaces`);
        return null;
    }
    
    // ΑΠΛΗ ΕΠΙΛΟΓΗ
    let optionsText = `Σύνδεση ${router.name} (Router) ↔ ${otherDevice.name} (${otherDevice.type}):\n\n`;
    optionsText += `Επιλογή interface για τον router ${router.name}:\n\n`;
    
    freeInterfaces.forEach((iface, index) => {
        let info = '';
        switch(iface) {
            case 'lan':
                info = `LAN (${router.interfaces.lan.ip}/24)`;
                break;
            case 'lan2':
                info = `LAN2 (${router.interfaces.lan2.ip}/24)`;
                break;
            case 'wan':
                info = `WAN (${router.interfaces.wan.ip || 'Θα δημιουργηθεί IP'})`;
                break;
        }
        optionsText += `${index + 1}. ${iface.toUpperCase()} - ${info}\n`;
    });
    
    optionsText += `\nΕισάγετε αριθμό (1-${freeInterfaces.length}):`;
    
    const interfaceChoice = prompt(optionsText, "1");
    const choiceIndex = parseInt(interfaceChoice) - 1;
    
    let selectedInterface = null;
    
    if (choiceIndex >= 0 && choiceIndex < freeInterfaces.length) {
        selectedInterface = freeInterfaces[choiceIndex];
    } else {
        selectedInterface = freeInterfaces[0] || 'lan';
    }
    
    console.log(`[ROUTER-DEVICE] Θα δημιουργηθεί σύνδεση με interface: ${selectedInterface}`);
    
    // Δημιουργία της σύνδεσης
    return this.createRouterToDeviceConnectionWithInterface(router, otherDevice, selectedInterface);
}

// Σύνδεση με συγκεκριμένο interface
createRouterToDeviceConnectionWithInterface(router, otherDevice, interfaceType) {
    console.log(`[ROUTER-DEVICE] Δημιουργία σύνδεσης με interface: ${interfaceType}`);
    
    // ΕΛΕΓΧΟΣ: Μπορεί ο router να δεχτεί σύνδεση στο συγκεκριμένο interface;
    const canConnect = this.canAcceptConnection(router, interfaceType);
    const canOtherConnect = this.canAcceptConnection(otherDevice);
    
    if (!canConnect || !canOtherConnect) {
        alert(`Το ${interfaceType.toUpperCase()} interface του ${router.name} δεν είναι διαθέσιμο!`);
        return null;
    }
    
    // Δημιουργία βασικής σύνδεσης
    const connection = this.createBasicConnection(router, otherDevice);
    
    if (connection) {
        // Αποθήκευση πληροφορίας interface
        if (!router.connectionInterfaces) router.connectionInterfaces = {};
        router.connectionInterfaces[connection.id] = interfaceType;
        
        // Αποθήκευση στο connection object
        if (connection.device1Id === router.id) {
            connection.interface1 = interfaceType;
        } else {
            connection.interface2 = interfaceType;
        }
        
        console.log(`[ROUTER-DEVICE] Δημιουργήθηκε: ${router.name} (${interfaceType}) ↔ ${otherDevice.name}`);
        
        // Ειδική περίπτωση: Cloud στο WAN
        if (interfaceType === 'wan' && otherDevice.type === 'cloud') {
            if (!router.interfaces.wan.ip || router.interfaces.wan.ip === 'N/A') {
                this.assignRouterWanIPForCloud(router, otherDevice);
            }
        }
        
        // Ενημέρωση IP της συσκευής αν χρειάζεται
        this.updateDeviceIPForRouterInterface(otherDevice, router, interfaceType);
        
        // Ενημέρωση UI
        if (window.uiManager) {
            window.uiManager.addLog(`Δημιουργήθηκε σύνδεση: ${router.name} (${interfaceType}) ↔ ${otherDevice.name}`, 'success');
        }
    }
    
    return connection;
}

// Ανάθεση WAN IP για Cloud
assignRouterWanIPForCloud(router, cloudDevice) {
    console.log(`[ROUTER WAN] Ανάθεση WAN IP για ${router.name} που συνδέεται με Cloud`);
    
    const cloudIP = cloudDevice.ip;
    
    if (cloudIP && cloudIP !== 'N/A' && cloudIP !== '0.0.0.0') {
        const ipParts = cloudIP.split('.');
        
        for (let i = 2; i < 254; i++) {
            ipParts[3] = i.toString();
            const potentialIP = ipParts.join('.');
            
            const existingDevice = window.deviceManager?.getDeviceByIP(potentialIP);
            if (!existingDevice || existingDevice.id === router.id) {
                router.interfaces.wan.ip = potentialIP;
                router.interfaces.wan.subnetMask = '255.255.255.0';
                router.interfaces.wan.gateway = cloudIP;
                
                console.log(`[ROUTER WAN] Ορίστηκε WAN IP: ${potentialIP}, Gateway: ${cloudIP}`);
                
                if (router.element && router.element.querySelector('.device-ip')) {
                    router.element.querySelector('.device-ip').innerHTML = 
                        `WAN: ${potentialIP}<br>LAN: ${router.interfaces.lan.ip}`;
                }
                
                return potentialIP;
            }
        }
    }
    
    router.interfaces.wan.ip = '192.168.1.6';
    router.interfaces.wan.subnetMask = '255.255.255.0';
    router.interfaces.wan.gateway = '192.168.1.1';
    
    console.log(`[ROUTER WAN] Fallback WAN IP: 192.168.1.6`);
    return '192.168.1.6';
}

// Ενημέρωση IP συσκευής βάσει router interface
updateDeviceIPForRouterInterface(device, router, interfaceType) {
    console.log(`[IP UPDATE] Ενημέρωση ${device.name} για interface ${interfaceType} του ${router.name}`);
    
    if (!device.ip || device.ip === 'N/A' || device.ip === '0.0.0.0') {
        let newIP = '';
        let gateway = '0.0.0.0';
        let subnet = '255.255.255.0';
        
        switch(interfaceType) {
            case 'lan':
                newIP = this.generateIPInRange(router.interfaces.lan.ip, 10);
                gateway = router.interfaces.lan.ip;
                subnet = router.interfaces.lan.subnetMask;
                break;
                
            case 'lan2':
                if (router.interfaces.lan2 && router.interfaces.lan2.enabled) {
                    newIP = this.generateIPInRange(router.interfaces.lan2.ip, 10);
                    gateway = router.interfaces.lan2.ip;
                    subnet = router.interfaces.lan2.subnetMask;
                }
                break;
                
            case 'wan':
                if (router.interfaces.wan.ip && router.interfaces.wan.ip !== 'N/A') {
                    newIP = this.generateIPInRange(router.interfaces.wan.ip, 10);
                    gateway = router.interfaces.wan.gateway || router.interfaces.wan.ip;
                    subnet = router.interfaces.wan.subnetMask;
                }
                break;
        }
        
        if (newIP) {
            device.ip = newIP;
            device.gateway = gateway;
            device.subnetMask = subnet;
            
            console.log(`[IP UPDATE] Ορίστηκε IP: ${newIP}, Gateway: ${gateway}, Subnet: ${subnet}`);
            
            if (device.element && device.element.querySelector('.device-ip')) {
                device.element.querySelector('.device-ip').textContent = newIP;
                device.element.querySelector('.device-ip').className = 'device-ip';
            }
        }
    }
}

// Δημιουργία IP σε συγκεκριμένο range
generateIPInRange(baseIP, startFrom = 10) {
    if (!baseIP || baseIP === 'N/A') return '192.168.1.10';
    
    const ipParts = baseIP.split('.');
    const baseNetwork = ipParts.slice(0, 3).join('.');
    
    for (let i = startFrom; i < 255; i++) {
        const potentialIP = `${baseNetwork}.${i}`;
        const existingDevice = window.deviceManager?.getDeviceByIP(potentialIP);
        
        if (!existingDevice) {
            return potentialIP;
        }
    }
    
    return `${baseNetwork}.${startFrom}`;
}

    createConnectionWithId(device1, device2, connectionId) {
        console.log(`[ΣΥΝΔΕΣΗ] Δημιουργία με προκαθορισμένο ID: ${connectionId}`);
        
        const can1 = this.canAcceptConnection(device1);
        const can2 = this.canAcceptConnection(device2);
        
        if (!can1 || !can2) {
            console.log(`[ΣΥΝΔΕΣΗ] Απορρίφθηκε: Μία συσκευή δεν μπορεί να δεχτεί σύνδεση`);
            return null;
        }
        
        const existingConnection = this.connections.find(conn => conn.id === connectionId);
        if (existingConnection) {
            console.log(`[ΣΥΝΔΕΣΗ] Σύνδεση με ID ${connectionId} υπάρχει ήδη`);
            return existingConnection;
        }
        
        const connection = {
            id: connectionId,
            device1Id: device1.id,
            device2Id: device2.id,
            type: 'direct',
            canCommunicate: true,
            timestamp: new Date().toISOString()
        };
        
        this.connections.push(connection);
        
        if (!device1.connections) device1.connections = [];
        if (!device2.connections) device2.connections = [];
        
        device1.connections.push(connectionId);
        device2.connections.push(connectionId);
        
        const communication = this.canDevicesCommunicateDirectly(device1, device2);
        connection.canCommunicate = communication.canCommunicate;
        connection.type = communication.viaGateway ? 'routed' : 'direct';
        
        console.log(`[ΣΥΝΔΕΣΗ] Δημιουργήθηκε με ID: ${connectionId}`);
        
        if (window.uiManager) {
            window.uiManager.addLog(`Δημιουργήθηκε σύνδεση: ${device1.name} ↔ ${device2.name}`, 'success');
            this.updateConnectionsVisual();
        }
        
        return connection;
    }
    
    // ==================== ΜΕΘΟΔΟΙ ΑΦΑΙΡΕΣΗΣ ΣΥΝΔΕΣΕΩΝ ====================
    
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
    
removeConnection(connection) {
    console.log(`[CONNECTION] Διαγραφή σύνδεσης: ${connection.id}`);
    
    const device1 = window.deviceManager.getDeviceById(connection.device1Id);
    const device2 = window.deviceManager.getDeviceById(connection.device2Id);
    
    // 1. Αφαίρεση από arrays συνδέσεων συσκευών
    if (device1 && device1.connections) {
        const index1 = device1.connections.indexOf(connection.id);
        if (index1 !== -1) {
            device1.connections.splice(index1, 1);
            console.log(`[CONNECTION] Αφαιρέθηκε από ${device1.name} connections`);
        }
    }
    
    if (device2 && device2.connections) {
        const index2 = device2.connections.indexOf(connection.id);
        if (index2 !== -1) {
            device2.connections.splice(index2, 1);
            console.log(`[CONNECTION] Αφαιρέθηκε από ${device2.name} connections`);
        }
    }
    
    // 2. ΑΦΑΙΡΕΣΗ ΑΠΟ CONNECTIONINTERFACES (ΑΥΤΟ ΕΙΝΑΙ ΤΟ ΚΕΥΦΑΛΙΚΟ!)
    if (device1 && device1.type === 'router' && device1.connectionInterfaces) {
        if (device1.connectionInterfaces[connection.id]) {
            console.log(`[CONNECTION] Διαγραφή interface από ${device1.name}: ${device1.connectionInterfaces[connection.id]}`);
            delete device1.connectionInterfaces[connection.id];
        } else {
            console.log(`[CONNECTION] ${device1.name}: Δεν υπήρχε interface για ${connection.id}`);
        }
    }
    
    if (device2 && device2.type === 'router' && device2.connectionInterfaces) {
        if (device2.connectionInterfaces[connection.id]) {
            console.log(`[CONNECTION] Διαγραφή interface από ${device2.name}: ${device2.connectionInterfaces[connection.id]}`);
            delete device2.connectionInterfaces[connection.id];
        } else {
            console.log(`[CONNECTION] ${device2.name}: Δεν υπήρχε interface για ${connection.id}`);
        }
    }
    
    // 3. Αφαίρεση από το DOM
    const connEl = document.getElementById(connection.id);
    if (connEl) {
        connEl.remove();
        console.log(`[CONNECTION] Αφαιρέθηκε από DOM: ${connection.id}`);
    }
    
    // 4. Αφαίρεση από τη λίστα συνδέσεων
    const connIndex = this.connections.indexOf(connection);
    if (connIndex !== -1) {
        this.connections.splice(connIndex, 1);
        console.log(`[CONNECTION] Αφαιρέθηκε από connections array`);
    }
    
    console.log(`[CONNECTION] Σύνδεση διαγράφηκε επιτυχώς: ${connection.id}`);
    
    // 5. Debug: Δείξε πόσα connectionInterfaces έχουν μείνει
    if (device1 && device1.type === 'router') {
        console.log(`[DEBUG] ${device1.name} connectionInterfaces μετά:`, 
                   device1.connectionInterfaces ? Object.keys(device1.connectionInterfaces) : 'none');
    }
    if (device2 && device2.type === 'router') {
        console.log(`[DEBUG] ${device2.name} connectionInterfaces μετά:`, 
                   device2.connectionInterfaces ? Object.keys(device2.connectionInterfaces) : 'none');
    }
    
    return connection;
}
    // ==================== ΜΕΘΟΔΟΙ ΕΝΗΜΕΡΩΣΗΣ ΚΑΙ ΟΠΤΙΚΟΠΟΙΗΣΗΣ ====================
    
    updateAllConnections(devices) {
        console.log(`[ΕΝΗΜΕΡΩΣΗ ΣΥΝΔΕΣΕΩΝ] Σύνολο συνδέσεων: ${this.connections.length}`);
        
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
            
            const isSwitch = (device) => device.type === 'switch';
            
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
    
    // ==================== ΜΕΘΟΔΟΙ ΕΠΙΚΟΙΝΩΝΙΑΣ ====================
    
    canDevicesCommunicateDirectly(device1, device2) {
        console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ] Έλεγχος: ${device1.name} ↔ ${device2.name}`);
        
        if (device1.id === device2.id) {
            return { canCommunicate: true, viaGateway: false };
        }
        
        if (this.areDevicesConnectedViaSwitch(device1, device2)) {
            console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ] Συνδεδεμένοι μέσω switch`);
            
            if (device1.type === 'switch' && device2.type === 'switch') {
                return { canCommunicate: true, viaGateway: false };
            }
            
            if ((device1.type === 'switch' && device1.ip === 'N/A') || 
                (device2.type === 'switch' && device2.ip === 'N/A')) {
                return { canCommunicate: true, viaGateway: false };
            }
            
            return this.checkCommunicationThroughSwitch(device1, device2);
        }
        
        if (!this.areDevicesConnected(device1, device2)) {
            console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ] Οι συσκευές ${device1.name} και ${device2.name} δεν είναι φυσικά συνδεδεμένες`);
            return { canCommunicate: false, viaGateway: false };
        }
        
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
        
        if (device1.type === 'router') {
            return this.canCommunicateWithRouter(device1, device2);
        }
        if (device2.type === 'router') {
            return this.canCommunicateWithRouter(device2, device1);
        }
        
        return this.canStandardDevicesCommunicate(device1, device2);
    }
    
    checkCommunicationThroughSwitch(device1, device2) {
        console.log(`[SWITCH] Επικοινωνία: ${device1.name} ↔ ${device2.name} μέσω switch`);
        
        const ip1 = this.getDeviceIP(device1);
        const ip2 = this.getDeviceIP(device2);
    
        if ((!ip1 || ip1 === 'N/A' || ip1 === '0.0.0.0' || ip1 === undefined) ||
            (!ip2 || ip2 === 'N/A' || ip2 === '0.0.0.0' || ip2 === undefined)) {
            console.log(`[SWITCH] Μία ή και οι δύο συσκευές δεν έχουν IP: ${ip1}, ${ip2}`);
            return { canCommunicate: false, viaGateway: false };
        }        
    
        const subnet1 = this.getDeviceSubnet(device1);
        const subnet2 = this.getDeviceSubnet(device2);
    
        console.log(`[SWITCH] Έλεγχος ίδιου δικτύου: ${ip1}/${subnet1} vs ${ip2}/${subnet2}`);
        if (areInSameNetwork(ip1, ip2, subnet1, subnet2)) {
            console.log(`[SWITCH] Ίδιο δίκτυο! Επικοινωνία δυνατή μέσω switch`);
            return { canCommunicate: true, viaGateway: false };
        }
        
        console.log(`[SWITCH] Διαφορετικά δίκτυα. Έλεγχος για gateway...`);
        
        const gateway1 = this.getDeviceGateway(device1);
        const gateway2 = this.getDeviceGateway(device2);
        
        if ((!gateway1 || gateway1 === '0.0.0.0' || gateway1 === 'N/A') &&
            (!gateway2 || gateway2 === '0.0.0.0' || gateway2 === 'N/A')) {
            console.log(`[SWITCH] ΔΕΝ έχει ρυθμιστεί GATEWAY. Επικοινωνία αδύνατη μεταξύ διαφορετικών δικτύων`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        return this.checkGatewayCommunication(device1, device2);
    }
    
    areDevicesConnectedViaSwitch(device1, device2) {
        const path = this.findPathBetweenDevices(device1, device2);
        
        if (!path || path.length < 3) {
            return false;
        }
        
        for (let i = 1; i < path.length - 1; i++) {
            if (path[i].type === 'switch') {
                console.log(`[ΜΕΣΩ SWITCH] ${device1.name} ↔ ${device2.name} μέσω ${path[i].name}`);
                return true;
            }
        }
        
        return false;
    }
    
    canStandardDevicesCommunicate(device1, device2) {
        console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] ${device1.name} ↔ ${device2.name}`);
        
        const ip1 = this.getDeviceIP(device1);
        const ip2 = this.getDeviceIP(device2);
        
        if ((!ip1 || ip1 === 'N/A' || ip1 === '0.0.0.0' || ip1 === undefined) ||
            (!ip2 || ip2 === 'N/A' || ip2 === '0.0.0.0' || ip2 === undefined)) {
            console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] Μία ή και οι δύο συσκευές δεν έχουν IP`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        const subnet1 = this.getDeviceSubnet(device1);
        const subnet2 = this.getDeviceSubnet(device2);
        
        console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] Έλεγχος ίδιου δικτύου: ${ip1}/${subnet1} vs ${ip2}/${subnet2}`);
        if (areInSameNetwork(ip1, ip2, subnet1, subnet2)) {
            console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] Ίδιο δίκτυο! Άμεση επικοινωνία δυνατή`);
            return { canCommunicate: true, viaGateway: false };
        }
        
        console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] Διαφορετικά δίκτυα. Έλεγχος για gateway...`);
        
        const gateway1 = this.getDeviceGateway(device1);
        const gateway2 = this.getDeviceGateway(device2);
        
        if ((!gateway1 || gateway1 === '0.0.0.0' || gateway1 === 'N/A') &&
            (!gateway2 || gateway2 === '0.0.0.0' || gateway2 === 'N/A')) {
            console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] ΔΕΝ έχει ρυθμιστεί GATEWAY. Επικοινωνία αδύνατη μεταξύ διαφορετικών δικτύων`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        console.log(`[ΤΥΠΙΚΗ ΕΠΙΚΟΙΝΩΝΙΑ] Έλεγχος επικοινωνίας μέσω gateway...`);
        return this.checkGatewayCommunication(device1, device2);
    }
    
    checkGatewayCommunication(device1, device2) {
        console.log(`[GATEWAY] Έλεγχος: ${device1.name} → ${device2.name}`);
        
        const gateway1 = this.getDeviceGateway(device1);
        if (gateway1 && gateway1 !== '0.0.0.0' && gateway1 !== 'N/A') {
            console.log(`[GATEWAY] Η ${device1.name} έχει gateway: ${gateway1}`);
            const gatewayDevice = window.deviceManager.getDeviceByIP(gateway1);
            
            if (gatewayDevice) {
                console.log(`[GATEWAY] Βρέθηκε συσκευή gateway: ${gatewayDevice.name}`);
                
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
        
        const gateway2 = this.getDeviceGateway(device2);
        if (gateway2 && gateway2 !== '0.0.0.0' && gateway2 !== 'N/A') {
            console.log(`[GATEWAY] Η ${device2.name} έχει gateway: ${gateway2}`);
            const gatewayDevice = window.deviceManager.getDeviceByIP(gateway2);
            
            if (gatewayDevice) {
                console.log(`[GATEWAY] Βρέθηκε συσκευή gateway: ${gatewayDevice.name}`);
                
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
    
    canCommunicateWithRouter(router, otherDevice) {
        console.log(`[ROUTER] Επικοινωνία: ${router.name} ↔ ${otherDevice.name}`);
        console.log(`[ROUTER] Router WAN: ${router.interfaces.wan.ip}, LAN: ${router.interfaces.lan.ip}`);
        
        const otherDeviceIP = this.getDeviceIP(otherDevice);
        console.log(`[ROUTER] Άλλη συσκευή: ${otherDevice.name} (${otherDevice.type}), IP: ${otherDeviceIP}`);
        
        if (otherDevice.type === 'switch' && otherDevice.ip === 'N/A') {
            console.log(`[ROUTER] Άμεση σύνδεση με switch`);
            return { canCommunicate: true, viaGateway: false };
        }
        
        if (this.areDevicesConnected(router, otherDevice)) {
            console.log(`[ROUTER] ΆΜΕΣΗ ΣΥΝΔΕΣΗ με ${otherDevice.name}`);
            
            if (otherDevice.type === 'cloud' || otherDevice.type === 'router') {
                console.log(`[ROUTER] Άμεση σύνδεση Cloud/Router, επικοινωνία ΔΥΝΑΤΗ`);
                
                if (otherDevice.type === 'router') {
                    const interface1 = this.getInterfaceForRouterConnection(router, otherDevice);
                    const interface2 = this.getInterfaceForRouterConnection(otherDevice, router);
                    
                    console.log(`[ROUTER↔ROUTER] Interface: ${interface1} ↔ ${interface2}`);
                    
                    if (interface1 === 'wan' && interface2 === 'lan') {
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
            
            if (otherDeviceIP && otherDeviceIP !== 'N/A') {
                const routerSubnet = router.interfaces.lan.subnetMask;
                const otherSubnet = this.getDeviceSubnet(otherDevice);
                
                if (otherDevice.type === 'cloud') {
                    console.log(`[ROUTER] Άμεση σύνδεση με Cloud, αποδέχομαι επικοινωνία`);
                    return { canCommunicate: true, viaGateway: false };
                }
            }
        }
        
        const routerLanIP = router.interfaces.lan.ip;
        if (!routerLanIP || routerLanIP === 'N/A' || routerLanIP === '0.0.0.0' || routerLanIP === undefined) {
            console.log(`[ROUTER] Το router δεν έχει έγκυρο LAN IP`);
            return { canCommunicate: false, viaGateway: false };
        }
        
        if (otherDeviceIP && otherDeviceIP !== 'N/A' && otherDeviceIP !== '0.0.0.0' && otherDeviceIP !== undefined) {
            console.log(`[ROUTER] Έλεγχος αν το ${otherDeviceIP} είναι στο ίδιο δίκτυο με το router LAN ${routerLanIP}`);
            
            const routerSubnet = router.interfaces.lan.subnetMask;
            const otherSubnet = this.getDeviceSubnet(otherDevice);
            
            if (areInSameNetwork(otherDeviceIP, routerLanIP, otherSubnet, routerSubnet)) {
                console.log(`[ROUTER] Η συσκευή είναι στο LAN του router`);
                return { canCommunicate: true, viaGateway: false };
            }
            
            if (this.isExternalIP(otherDeviceIP)) {
                console.log(`[ROUTER] Το ${otherDeviceIP} είναι ΕΞΩΤΕΡΙΚΟ IP (Internet)`);
                
                const allRouters = window.deviceManager.devices.filter(d => d.type === 'router');
                
                console.log(`[ROUTER] Αναζήτηση σε ${allRouters.length} routers για σύνδεση με ${otherDevice.name}`);
                
                for (const someRouter of allRouters) {
                    if (this.areDevicesConnected(someRouter, otherDevice)) {
                        console.log(`[ROUTER] Το ${otherDevice.name} είναι ΣΥΝΔΕΔΕΜΕΝΟ με ${someRouter.name}`);
                        
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
                
                console.log(`[ROUTER] Έλεγχος για internet access...`);
                
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
        
        const otherGateway = this.getDeviceGateway(otherDevice);
        if (otherGateway && otherGateway !== '0.0.0.0' && otherGateway !== 'N/A') {
            console.log(`[ROUTER] Gateway συσκευής: ${otherGateway}, Router LAN: ${routerLanIP}`);
            if (otherGateway === routerLanIP) {
                console.log(`[ROUTER] Η συσκευή χρησιμοποιεί το router ως gateway`);
                
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
    
    // ==================== ΒΟΗΘΗΤΙΚΕΣ ΜΕΘΟΔΟΙ ΓΙΑ ΣΥΝΔΕΣΕΙΣ ====================
    
    areDevicesConnected(device1, device2) {
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
        
        if (areInSameNetwork(sourceIP, destIP, sourceSubnet, destSubnetMask)) {
            return false;
        }
        
        return true;
    }
    
    getConnectedDevices(device) {
        const connected = [];
        
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
    
    findPathBetweenDevices(device1, device2) {
        if (device1.id === device2.id) return [device1];
        
        console.log(`[ΔΙΑΔΡΟΜΗ] Εύρεση διαδρομής: ${device1.name} → ${device2.name}`);
        
        if (this.areDevicesConnected(device1, device2)) {
            console.log(`[ΔΙΑΔΡΟΜΗ] Βρέθηκε άμεση σύνδεση`);
            return [device1, device2];
        }
        
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
    
    canDevicesCommunicateWithPath(device1, device2) {
        const path = this.findPathBetweenDevices(device1, device2);
        
        console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ ΜΕ ΔΙΑΔΡΟΜΗ] ${device1.name} → ${device2.name}:`, 
                   path ? path.map(d => d.name).join(' → ') : 'ΔΕΝ ΥΠΑΡΧΕΙ ΔΙΑΔΡΟΜΗ');
        
        if (!path || path.length < 2) {
            console.log(`[ΕΠΙΚΟΙΝΩΝΙΑ ΜΕ ΔΙΑΔΡΟΜΗ] Δεν υπάρχει διαδρομή ή είναι άκυρη`);
            return { canCommunicate: false, viaGateway: false, path: null };
        }
        
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
    
    removeDevice(device) {
        const connectionsToRemove = [...device.connections];
        connectionsToRemove.forEach(connId => {
            this.removeConnectionById(connId);
        });
        
        return device;
    }
    
    clearAllConnections() {
        const connectionsCopy = [...this.connections];
        connectionsCopy.forEach(connection => {
            this.removeConnection(connection);
        });
        
        this.connections = [];
        this.packets = [];
    }
    
    // ==================== ΜΕΘΟΔΟΙ ΓΙΑ ROUTING ====================
    
    getNetworkAddress(ip, subnetMask) {
        if (!ip || ip === 'N/A') return null;
        const ipParts = ip.split('.').map(Number);
        const maskParts = subnetMask.split('.').map(Number);
        
        const networkParts = ipParts.map((part, i) => part & maskParts[i]);
        return networkParts.join('.');
    }
    
    isIPInNetwork(ip, network, subnetMask) {
        const ipNetwork = this.getNetworkAddress(ip, subnetMask);
        return ipNetwork === network;
    }

    autoGenerateRoutesForRouter(router) {
        console.log(`[AUTO ROUTES] Δημιουργία routes για τον router: ${router.name}`);
        
        if (!router.routingTable) {
            router.routingTable = [];
        }
        
        const existingRoutes = [...router.routingTable];
        const newRoutes = [];
        
        try {
            if (router.type === 'router') {
                if (router.interfaces.lan.ip && router.interfaces.lan.ip !== 'N/A') {
                    const lanNetwork = this.getNetworkFromIP(router.interfaces.lan.ip, router.interfaces.lan.subnetMask || '255.255.255.0');
                    const lanRoute = {
                        network: lanNetwork,
                        mask: router.interfaces.lan.subnetMask || '255.255.255.0',
                        gateway: '0.0.0.0',
                        interface: 'lan',
                        metric: 0
                    };
                    
                    if (!this.routeExists(router.routingTable, lanRoute)) {
                        router.routingTable.push(lanRoute);
                        newRoutes.push(lanRoute);
                    }
                }
                
                if (router.interfaces.wan.ip && router.interfaces.wan.ip !== 'N/A') {
                    const wanNetwork = this.getNetworkFromIP(router.interfaces.wan.ip, router.interfaces.wan.subnetMask || '255.255.255.0');
                    const wanRoute = {
                        network: wanNetwork,
                        mask: router.interfaces.wan.subnetMask || '255.255.255.0',
                        gateway: '0.0.0.0',
                        interface: 'wan',
                        metric: 0
                    };
                    
                    if (!this.routeExists(router.routingTable, wanRoute)) {
                        router.routingTable.push(wanRoute);
                        newRoutes.push(wanRoute);
                    }
                }
            }
            
            const deviceManager = window.deviceManager;
            if (deviceManager) {
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
                
                connectedDevices.forEach(device => {
                    if (device.ip && device.ip !== 'N/A' && device.subnetMask) {
                        const network = this.getNetworkFromIP(device.ip, device.subnetMask);
                        const route = {
                            network: network,
                            mask: device.subnetMask,
                            gateway: device.ip,
                            interface: this.getInterfaceForDevice(router, device),
                            metric: 1
                        };
                        
                        if (!this.routeExists(router.routingTable, route)) {
                            router.routingTable.push(route);
                            newRoutes.push(route);
                        }
                    }
                });
            }
            
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

    routeExists(routingTable, route) {
        return routingTable.some(existingRoute => 
            existingRoute.network === route.network &&
            existingRoute.mask === route.mask &&
            existingRoute.gateway === route.gateway
        );
    }

    getInterfaceForDevice(router, device) {
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
        
        return 'lan';
    }
    
    addAutoRoutesForRouterConnection(router1, router2, interface1, interface2) {
        console.log(`[AUTO ROUTER ROUTES] Προσθήκη routes για: ${router1.name} (${interface1}) ↔ ${router2.name} (${interface2})`);
        
        if (!router1.routingTable) router1.routingTable = [];
        if (!router2.routingTable) router2.routingTable = [];
        
        // ΑΠΛΗ ΛΟΓΙΚΗ: Αν είναι LAN ↔ WAN, βάλε routes
        if (interface1 === 'lan' && interface2 === 'wan') {
            if (router1.interfaces.lan.ip && router1.interfaces.lan.ip !== 'N/A') {
                const router1Network = this.getNetworkFromIP(router1.interfaces.lan.ip, router1.interfaces.lan.subnetMask);
                
                // Router2 μπορεί να φτάσει το LAN του Router1
                router2.routingTable.push({
                    network: router1Network,
                    mask: router1.interfaces.lan.subnetMask,
                    gateway: router2.interfaces.wan.ip,
                    interface: 'wan'
                });
                
                console.log(`[AUTO ROUTER ROUTES] Προστέθηκε route στο ${router2.name}: ${router1Network} → ${router2.interfaces.wan.ip}`);
            }
        }
        else if (interface1 === 'wan' && interface2 === 'lan') {
            if (router2.interfaces.lan.ip && router2.interfaces.lan.ip !== 'N/A') {
                const router2Network = this.getNetworkFromIP(router2.interfaces.lan.ip, router2.interfaces.lan.subnetMask);
                
                // Router1 μπορεί να φτάσει το LAN του Router2
                router1.routingTable.push({
                    network: router2Network,
                    mask: router2.interfaces.lan.subnetMask,
                    gateway: router1.interfaces.wan.ip,
                    interface: 'wan'
                });
                
                console.log(`[AUTO ROUTER ROUTES] Προστέθηκε route στο ${router1.name}: ${router2Network} → ${router1.interfaces.wan.ip}`);
            }
        }
        
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
    
    // ΑΦΑΙΡΩ ΤΙΣ ΠΕΡΙΣΣΕΣ ΜΕΘΟΔΟΥΣ ΠΟΥ ΚΑΝΟΥΝ "ΈΞΥΠΝΗ" ΛΟΓΙΚΗ
    
    // ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ Η isInterfaceComboValid - ΑΦΗΝΟΥΜΕ ΤΟΝ ΧΡΗΣΤΗ ΝΑ ΑΠΟΦΑΣΙΣΕΙ
    
    // ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ Η createRouterToRouterConnectionWithLAN2Support - ΧΡΗΣΙΜΟΠΟΙΕΙΤΑΙ Η ΚΥΡΙΑ
    
    // ΔΕΝ ΧΡΕΙΑΖΕΤΑΙ Η canRoutersConnect με όλους τους ελέγχους - ΚΑΝΟΥΜΕ ΑΠΛΟ ΕΛΕΓΧΟ
    
}

// Εξαγωγή της κλάσης
export default ConnectionManager;
