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
import { isValidIP, isValidSubnetMask, generateRandomIP } from './network-core.js';

// Διαχείριση συσκευών
class DeviceManager {
    constructor() {
        this.devices = [];
        this.deviceCounter = 1;
        this.selectedDevice = null;
    }

    // Προσθήκη νέας συσκευής
    addDevice(type, color, x, y, workspaceEl) {
        const deviceId = `device-${this.deviceCounter++}`;
        const deviceName = `${window.CONFIG.DEVICE_TYPES[type].name} ${this.deviceCounter-1}`;
        
        // Δημιουργία στοιχείου συσκευής
        const deviceEl = this.createDeviceElement(deviceId, deviceName, type, color, x, y);
        workspaceEl.appendChild(deviceEl);
        
        // Δημιουργία αντικειμένου συσκευής
        const device = this.createDeviceObject(deviceId, type, deviceName, x, y, deviceEl);
        this.devices.push(device);
        
        // Προσθήκη event listeners
        this.addDeviceEventListeners(deviceEl, device);
        
        // Επιλογή συσκευής
        this.selectDevice(device);
        
        return device;
    }
    
    // Δημιουργία DOM element συσκευής
    createDeviceElement(deviceId, deviceName, type, color, x, y) {
        const deviceEl = document.createElement('div');
        deviceEl.className = 'device';
        deviceEl.id = deviceId;
        deviceEl.style.left = `${x}px`;
        deviceEl.style.top = `${y}px`;
        deviceEl.style.backgroundColor = color;
        deviceEl.style.color = 'white';
        deviceEl.style.border = `3px solid ${this.darkenColor(color, 20)}`;
        
        // Προσθήκη περιεχομένου με βάση τον τύπο
        const deviceInfo = window.CONFIG.DEVICE_TYPES[type];
        deviceEl.innerHTML = `
            <i class="${deviceInfo.icon}"></i>
            <div class="device-name">${deviceName}</div>
            <div class="device-ip">${this.getDefaultIPDisplay(type)}</div>
        `;
        
        return deviceEl;
    }
    
    // Δημιουργία αντικειμένου συσκευής
    createDeviceObject(deviceId, type, deviceName, x, y, element) {
        let device;
        
        switch(type) {
            case 'router':
                device = this.createRouterDevice(deviceId, type, deviceName, x, y, element);
                break;
            case 'switch':
                device = this.createSwitchDevice(deviceId, type, deviceName, x, y, element);
                break;
            case 'cloud':
                device = this.createCloudDevice(deviceId, type, deviceName, x, y, element);
                break;
            case 'dns':
                device = this.createDNSDevice(deviceId, type, deviceName, x, y, element);
                break;
            default:
                device = this.createStandardDevice(deviceId, type, deviceName, x, y, element);
        }
        
        return device;
    }
    
    // Δημιουργία Router συσκευής - ΣΥΜΒΑΤΗ ΜΕ ΚΑΙ ΤΑ ΔΥΟ (lan ΚΑΙ lan1/lan2)
    createRouterDevice(deviceId, type, deviceName, x, y, element) {
        const router = {
            id: deviceId,
            type: type,
            name: deviceName,
            interfaces: {
                wan: { 
                    ip: 'N/A', 
                    subnetMask: '255.255.255.0', 
                    gateway: '0.0.0.0',
                    dns: ['8.8.8.8']
                },
                // ΠΑΡΑΚΑΤΩ: Κρατάμε και το παλιό 'lan' ΓΙΑ ΣΥΜΒΑΤΟΤΗΤΑ
                lan: { 
                    ip: '192.168.1.1', 
                    subnetMask: '255.255.255.0', 
                    gateway: '0.0.0.0',
                    dns: ['192.168.1.1']
                },
                lan2: { 
                    ip: '192.168.2.1', 
                    subnetMask: '255.255.255.0', 
                    gateway: '0.0.0.0',
                    dns: ['192.168.2.1'],
                    enabled: true
                }
            },
            connectionInterfaces: {},
            routingTable: [],
            x: x,
            y: y,
            element: element,
            connections: [],
            status: 'online',
            isGateway: true
        };
                
        return router;
    }
    
    // Δημιουργία Switch συσκευής
    createSwitchDevice(deviceId, type, deviceName, x, y, element) {
        return {
            id: deviceId,
            type: type,
            name: deviceName,
            ip: 'N/A',
            subnetMask: '255.255.255.0',
            gateway: '0.0.0.0',
            dns: [],
            x: x,
            y: y,
            element: element,
            connections: [],
            status: 'online'
        };
    }
    
    // Δημιουργία Cloud συσκευής
    createCloudDevice(deviceId, type, deviceName, x, y, element) {
        return {
            id: deviceId,
            type: type,
            name: deviceName,
            ip: '8.8.8.8',
            subnetMask: '255.255.255.0',
            gateway: '0.0.0.0',
            dns: ['8.8.8.8'],
            x: x,
            y: y,
            element: element,
            connections: [],
            status: 'online'
        };
    }
    
    // Δημιουργία DNS Server συσκευής
    createDNSDevice(deviceId, type, deviceName, x, y, element) {
        return {
            id: deviceId,
            type: type,
            name: deviceName,
            ip: '192.168.1.53',
            subnetMask: '255.255.255.0',
            gateway: '192.168.1.1',
            dns: ['192.168.1.53'],
            x: x,
            y: y,
            element: element,
            connections: [],
            status: 'online',
            dnsRecords: {}
        };
    }
    
    // Δημιουργία τυπικής συσκευής (computer, server, printer)
    createStandardDevice(deviceId, type, deviceName, x, y, element) {
        // Δημιουργία τυχαίας IP εντός LAN range
        let ipAddress, gateway = '0.0.0.0', dns = [];
        
        // Προσπάθεια να βρεθεί router για να πάρουμε το LAN του
        const router = this.devices.find(d => d.type === 'router');
        if (router && router.interfaces.lan.ip !== 'N/A') {
            const lanIP = router.interfaces.lan.ip;
            const subnetMask = router.interfaces.lan.subnetMask;
            ipAddress = generateRandomIP(lanIP, subnetMask);
            gateway = lanIP;
            dns = [lanIP];
        } else {
            // Δημιουργία τυχαίας IP
            ipAddress = `192.168.${Math.floor(Math.random() * 254) + 1}.${Math.floor(Math.random() * 200) + 10}`;
            dns = ['8.8.8.8'];
        }
        
        return {
            id: deviceId,
            type: type,
            name: deviceName,
            ip: ipAddress,
            subnetMask: '255.255.255.0',
            gateway: gateway,
            dns: dns,
            x: x,
            y: y,
            element: element,
            connections: [],
            status: 'online',
            domainName: null,
            dnsCache: {}
        };
    }
    
    // Προσθήκη event listeners σε συσκευή
    addDeviceEventListeners(deviceEl, device) {
        deviceEl.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Ειδικά modes → ΜΗΝ ανοίξεις panel
            if (window.uiManager?.connectionMode ||
                window.uiManager?.testMode ||
                window.uiManager?.manualDNSMode) {
                
                // ΜΟΝΟ το mode-specific click, ΧΩΡΙΣ επιπλέον UI effects
                if (window.uiManager.connectionMode) window.uiManager.handleConnectionClick(device);
                if (window.uiManager.testMode) window.uiManager.handleTestModeClick(device);
                if (window.uiManager.manualDNSMode) window.uiManager.handleManualDNSModeClick(device);
                
                return; // ΠΟΤΕ show panel
            }
            
            // Κανονικό click → άνοιγμα panel
            window.handleDeviceClick(device);
            window.showDevicePanel(device);
        });
        
        this.makeDeviceDraggable(deviceEl, device);
    }
    
    // Καθιστά τη συσκευή μετακινήσιμη
    makeDeviceDraggable(deviceEl, device) {
        let isDragging = false;
        let offsetX, offsetY;
        
        deviceEl.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            isDragging = true;
            
            const rect = deviceEl.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            
            deviceEl.style.cursor = 'grabbing';
            deviceEl.style.zIndex = '100';
            
            document.addEventListener('mousemove', drag);
            document.addEventListener('mouseup', stopDrag);
            e.preventDefault();
        });
        
        const drag = (e) => {
            if (!isDragging) return;
            
            const workspaceRect = document.getElementById('workspace').getBoundingClientRect();
            let newX = e.clientX - workspaceRect.left - offsetX;
            let newY = e.clientY - workspaceRect.top - offsetY;
            
            const maxX = workspaceRect.width - 120;
            const maxY = workspaceRect.height - 120;
            
            device.x = Math.max(0, Math.min(newX, maxX));
            device.y = Math.max(0, Math.min(newY, maxY));
            
            deviceEl.style.left = `${device.x}px`;
            deviceEl.style.top = `${device.y}px`;
            
            // Ενημέρωση συνδέσεων
            if (typeof window.updateConnections === 'function') {
                window.updateConnections();
            }
        };
        
        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
                deviceEl.style.cursor = 'pointer';
                deviceEl.style.zIndex = '10';
                
                document.removeEventListener('mousemove', drag);
                document.removeEventListener('mouseup', stopDrag);
            }
        };
    }
    
    // Επιλογή συσκευής
    selectDevice(device) {
        if (this.selectedDevice) {
            this.selectedDevice.element.classList.remove('selected');
        }
        this.selectedDevice = device;
        device.element.classList.add('selected');
        
        // Ενημέρωση πληροφοριών συσκευής
        if (typeof window.updateDeviceInfo === 'function') {
            window.updateDeviceInfo(device);
        }
    }
    
    // Αφαίρεση συσκευής
    removeDevice(device) {
        // Αφαίρεση όλων των συνδέσεων της συσκευής
        const connectionsToRemove = [...device.connections];
        connectionsToRemove.forEach(connId => {
            if (typeof window.removeConnectionById === 'function') {
                window.removeConnectionById(connId);
            }
        });
        
        // Αφαίρεση από το DOM
        device.element.remove();
        
        // Αφαίρεση από τη λίστα συσκευών
        const deviceIndex = this.devices.indexOf(device);
        if (deviceIndex !== -1) {
            this.devices.splice(deviceIndex, 1);
        }
        
        // Επαναφορά επιλεγμένης συσκευής
        this.selectedDevice = null;
        
        return device;
    }
    
    // Βοηθητικές συναρτήσεις
    getDefaultIPDisplay(type) {
        switch(type) {
            case 'router': return 'WAN: N/A<br>LAN: 192.168.1.1<br>LAN2: 192.168.2.1';  // Προσθήκη LAN2
            case 'switch': return '<span class="no-ip">Χωρίς IP</span>';
            case 'cloud': return '8.8.8.8';
            case 'dns': return '192.168.1.53';
            default: return '192.168.1.x';
        }
    }
    
    darkenColor(color, percent) {
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        
        return "#" + (
            0x1000000 +
            (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
            (B < 255 ? (B < 1 ? 0 : B) : 255)
        ).toString(16).slice(1);
    }
    
    // Βρείτε συσκευή με βάση το ID
    getDeviceById(id) {
        return this.devices.find(d => d.id === id);
    }
    
    // Βρείτε συσκευή με βάση το IP - ΕΠΕΚΤΑΣΗ ΓΙΑ 2 LAN
    getDeviceByIP(ip) {
        if (!ip || ip === 'N/A' || ip === '0.0.0.0') return null;
        
        // Έλεγχος για routers πρώτα (έχουν πολλαπλές διεπαφές)
        for (const device of this.devices) {
            if (device.type === 'router') {
                // Ελέγχουμε όλα τα interfaces
                if (device.interfaces.wan.ip === ip) return device;
                if (device.interfaces.lan.ip === ip) return device;
                if (device.interfaces.lan1 && device.interfaces.lan1.ip === ip) return device;
                if (device.interfaces.lan2 && device.interfaces.lan2.ip === ip) return device;
            } else if (device.ip === ip) {
                return device;
            }
        }
        
        return null;
    }
    
    // Βρείτε συσκευή με βάση το domain name
    getDeviceByDomain(domain, globalDnsRecords) {
        // Έλεγχος global DNS records
        if (globalDnsRecords && globalDnsRecords[domain]) {
            const ip = globalDnsRecords[domain];
            return this.getDeviceByIP(ip);
        }
        
        // Έλεγχος σε κάθε συσκευή για domain name
        for (const device of this.devices) {
            if (device.domainName === domain) {
                return device;
            }
        }
        
        return null;
    }
    
    // Βρείτε DNS server (πρώτο διαθέσιμο)
    findDNSServer() {
        // Πρώτα βρες DNS server συσκευή
        const dnsDevice = this.devices.find(d => d.type === 'dns');
        if (dnsDevice) return dnsDevice;
        
        // Μετά βρες router με DNS
        const router = this.devices.find(d => d.type === 'router');
        if (router && router.interfaces.lan.dns && router.interfaces.lan.dns.length > 0) {
            const dnsIP = router.interfaces.lan.dns[0];
            return this.getDeviceByIP(dnsIP);
        }
        
        return null;
    }
    
    // ΑΠΛΗ ΣΥΝΑΡΤΗΣΗ ΕΛΕΓΧΟΥ IP - ΜΟΝΟ 0-255 ΤΑ BYTES
    simpleIPCheck(ip) {
        if (!ip || ip === 'N/A' || ip === '0.0.0.0') {
            return true; // Αυτές είναι αποδεκτές
        }
        
        const parts = ip.split('.');
        if (parts.length !== 4) return false;
        
        for (const part of parts) {
            const num = parseInt(part, 10);
            if (isNaN(num) || num < 0 || num > 255) {
                return false;
            }
        }
        
        return true;
    }
    
    // ΑΠΛΗ ΣΥΝΑΡΤΗΣΗ ΕΛΕΓΧΟΥ SUBNET MASK
    simpleSubnetCheck(mask) {
        if (!mask || mask === '0.0.0.0') return false;
        
        // Κοινές μάσκες που είναι αποδεκτές
        const validMasks = [
            '255.255.255.0',
            '255.255.0.0',
            '255.0.0.0',
            '255.255.255.128',
            '255.255.255.192',
            '255.255.255.224',
            '255.255.255.240',
            '255.255.255.248',
            '255.255.255.252',
            '255.255.255.254',
            '255.255.255.255'
        ];
        
        if (validMasks.includes(mask)) return true;
        
        // Αν δεν είναι κοινή, έλεγχος βασικών bytes
        return this.simpleIPCheck(mask);
    }
    
    // Ενημέρωση ρυθμίσεων συσκευής (ενιαία μέθοδος)
    updateDeviceConfig(device, configData) {
        try {
            if (device.type === 'router') {
                return this.updateRouterConfig(device, configData);
            } else {
                return this.updateStandardDeviceConfig(device, configData);
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
    
    // Ενημέρωση router - ΕΠΕΚΤΑΣΗ ΓΙΑ ΟΛΑ ΤΑ INTERFACES
    updateRouterConfig(router, configData) {
        const { 
            wanIp, wanSubnet, wanGateway, wanDns, 
            lanIp, lanSubnet, lanGateway, lanDns,
            lan2Ip, lan2Subnet, lan2Gateway, lan2Dns, lan2Enabled 
        } = configData;
        
        // WAN Interface
        if (wanIp !== undefined) {
            if (wanIp && wanIp !== 'N/A') {
                if (!this.simpleIPCheck(wanIp)) {
                    throw new Error('Λάθος WAN IP: Κάθε αριθμός πρέπει να είναι 0-255 (π.χ. 192.168.1.1)');
                }
                router.interfaces.wan.ip = wanIp;
            }
        }
        
        if (wanSubnet !== undefined) {
            if (wanSubnet) {
                if (!this.simpleSubnetCheck(wanSubnet)) {
                    throw new Error('Λάθος WAN Subnet: Μη έγκυρη μάσκα (π.χ. 255.255.255.0)');
                }
                router.interfaces.wan.subnetMask = wanSubnet;
            }
        }
        
        if (wanGateway !== undefined) {
            if (wanGateway && wanGateway !== '0.0.0.0') {
                if (!this.simpleIPCheck(wanGateway)) {
                    throw new Error('Λάθος WAN Gateway: Κάθε αριθμός πρέπει να είναι 0-255');
                }
                router.interfaces.wan.gateway = wanGateway;
            }
        }
        
        if (wanDns !== undefined) {
            if (wanDns && wanDns !== '0.0.0.0') {
                if (!this.simpleIPCheck(wanDns)) {
                    throw new Error('Λάθος WAN DNS: Κάθε αριθμός πρέπει να είναι 0-255');
                }
                router.interfaces.wan.dns = [wanDns];
            }
        }
        
        // LAN Interface - ΣΥΝΧΡΟΝΙΖΟΥΜΕ ΚΑΙ ΤΑ ΔΥΟ (lan και lan1)
        if (lanIp !== undefined) {
            if (lanIp && lanIp !== 'N/A') {
                if (!this.simpleIPCheck(lanIp)) {
                    throw new Error('Λάθος LAN IP: Κάθε αριθμός πρέπει να είναι 0-255 (π.χ. 192.168.1.1)');
                }
                router.interfaces.lan.ip = lanIp;
                if (router.interfaces.lan1) {
                    router.interfaces.lan1.ip = lanIp;
                }
            }
        }
        
        if (lanSubnet !== undefined) {
            if (lanSubnet) {
                if (!this.simpleSubnetCheck(lanSubnet)) {
                    throw new Error('Λάθος LAN Subnet: Μη έγκυρη μάσκα (π.χ. 255.255.255.0)');
                }
                router.interfaces.lan.subnetMask = lanSubnet;
                if (router.interfaces.lan1) {
                    router.interfaces.lan1.subnetMask = lanSubnet;
                }
            }
        }
        
        if (lanGateway !== undefined) {
            if (lanGateway && lanGateway !== '0.0.0.0') {
                if (!this.simpleIPCheck(lanGateway)) {
                    throw new Error('Λάθος LAN Gateway: Κάθε αριθμός πρέπει να είναι 0-255');
                }
                router.interfaces.lan.gateway = lanGateway;
                if (router.interfaces.lan1) {
                    router.interfaces.lan1.gateway = lanGateway;
                }
            }
        }
        
        if (lanDns !== undefined) {
            if (lanDns && lanDns !== '0.0.0.0') {
                if (!this.simpleIPCheck(lanDns)) {
                    throw new Error('Λάθος LAN DNS: Κάθε αριθμός πρέπει να είναι 0-255');
                }
                router.interfaces.lan.dns = [lanDns];
                if (router.interfaces.lan1) {
                    router.interfaces.lan1.dns = [lanDns];
                }
            }
        }
        
        // LAN2 Interface
        if (lan2Ip !== undefined && lan2Ip !== 'N/A') {
            if (!this.simpleIPCheck(lan2Ip)) {
                throw new Error('Λάθος LAN2 IP: Κάθε αριθμός πρέπει να είναι 0-255 (π.χ. 192.168.2.1)');
            }
            router.interfaces.lan2.ip = lan2Ip;
        }
        
        if (lan2Subnet !== undefined) {
            if (lan2Subnet) {
                if (!this.simpleSubnetCheck(lan2Subnet)) {
                    throw new Error('Λάθος LAN2 Subnet: Μη έγκυρη μάσκα (π.χ. 255.255.255.0)');
                }
                router.interfaces.lan2.subnetMask = lan2Subnet;
            }
        }
        
        if (lan2Gateway !== undefined) {
            if (lan2Gateway && lan2Gateway !== '0.0.0.0') {
                if (!this.simpleIPCheck(lan2Gateway)) {
                    throw new Error('Λάθος LAN2 Gateway: Κάθε αριθμός πρέπει να είναι 0-255');
                }
                router.interfaces.lan2.gateway = lan2Gateway;
            }
        }
        
        if (lan2Dns !== undefined && lan2Dns !== '0.0.0.0') {
            if (!this.simpleIPCheck(lan2Dns)) {
                throw new Error('Λάθος LAN2 DNS: Κάθε αριθμός πρέπει να είναι 0-255');
            }
            router.interfaces.lan2.dns = [lan2Dns];
        }
        
        if (lan2Enabled !== undefined) {
            router.interfaces.lan2.enabled = lan2Enabled;
        }
        
        // Ενημέρωση εμφάνισης
        router.element.querySelector('.device-ip').innerHTML = 
            `WAN: ${router.interfaces.wan.ip}<br>` +
            `LAN: ${router.interfaces.lan.ip}<br>` +
            `LAN2: ${router.interfaces.lan2.ip}${router.interfaces.lan2.enabled ? '' : ' (ανενεργό)'}`;
        
        return { success: true, router };
    }
    
    // Ενημέρωση τυπικής συσκευής
// Ενημέρωση τυπικής συσκευής
updateStandardDeviceConfig(device, configData) {
    const { ip, subnet, gateway, dns, domainName } = configData;
    
    // Ειδική περίπτωση για switches χωρίς IP
    if (device.type === 'switch') {
        if (ip === 'N/A' || ip === '' || !ip) {
            device.ip = 'N/A';
            device.subnetMask = '255.255.255.0';
            device.gateway = '0.0.0.0';
            device.dns = [];
            
            if (device.element) {
                device.element.querySelector('.device-ip').innerHTML = '<span class="no-ip">Χωρίς IP</span>';
                device.element.querySelector('.device-ip').className = 'device-ip no-ip';
            }
            
            return { success: true, device };
        }
    }
    
    // ΑΠΛΟΣ ΕΛΕΓΧΟΣ IP
    if (ip && ip !== 'N/A') {
        if (!this.simpleIPCheck(ip)) {
            throw new Error('Λάθος IP: Κάθε αριθμός πρέπει να είναι 0-255 (π.χ. 192.168.1.10)');
        }
        device.ip = ip;
        
        if (device.element) {
            device.element.querySelector('.device-ip').textContent = ip;
            device.element.querySelector('.device-ip').className = 'device-ip';
        }
    }
    
    // ΑΠΛΟΣ ΕΛΕΓΧΟΣ Subnet
    if (subnet) {
        if (!this.simpleSubnetCheck(subnet)) {
            throw new Error('Λάθος Subnet: Μη έγκυρη μάσκα (π.χ. 255.255.255.0)');
        }
        device.subnetMask = subnet;
    }
    
    // ΑΠΛΟΣ ΕΛΕΓΧΟΣ Gateway
    if (gateway && gateway !== '0.0.0.0') {
        if (!this.simpleIPCheck(gateway)) {
            throw new Error('Λάθος Gateway: Κάθε αριθμός πρέπει να είναι 0-255');
        }
        device.gateway = gateway;
    }
    
    // ΑΠΛΟΣ ΕΛΕΓΧΟΣ DNS
    if (dns && dns !== '0.0.0.0') {
        if (!this.simpleIPCheck(dns)) {
            throw new Error('Λάθος DNS: Κάθε αριθμός πρέπει να είναι 0-255');
        }
        device.dns = [dns];
    }
    
    if (domainName && domainName.trim() !== '') {
        device.domainName = domainName;
        
        // Προσθήκη στο DNS manager
        if (typeof window.dnsManager !== 'undefined' && device.ip && device.ip !== 'N/A') {
            window.dnsManager.addDNSRecord(domainName, device.ip);
        }
    }
    
    return { success: true, device };
}    
// Βοηθητική συνάρτηση για ενημέρωση από UI
updateDeviceConfigFromUI(device) {
    let configData = {};
    
    // Helper function to safely get value without errors
    const getValue = (id, defaultValue) => {
        try {
            const element = document.getElementById(id);
            return element && element.value !== undefined ? element.value : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    };
    
    if (device.type === 'router') {
        configData = {
            wanIp: getValue('routerWanIp', device.interfaces?.wan?.ip || 'N/A'),
            wanSubnet: getValue('routerWanSubnet', device.interfaces?.wan?.subnetMask || '255.255.255.0'),
            wanGateway: getValue('routerWanGateway', device.interfaces?.wan?.gateway || '0.0.0.0'),
            wanDns: getValue('routerWanDns', device.interfaces?.wan?.dns?.[0] || '8.8.8.8'),
            lanIp: getValue('routerLanIp', device.interfaces?.lan?.ip || '192.168.1.1'),
            lanSubnet: getValue('routerLanSubnet', device.interfaces?.lan?.subnetMask || '255.255.255.0'),
            lanGateway: getValue('routerLanGateway', device.interfaces?.lan?.gateway || '0.0.0.0'),
            lanDns: getValue('routerLanDns', device.interfaces?.lan?.dns?.[0] || device.interfaces?.lan?.ip || '192.168.1.1'),
            lan2Ip: getValue('routerLan2Ip', device.interfaces?.lan2?.ip || '192.168.2.1'),
            lan2Subnet: getValue('routerLan2Subnet', device.interfaces?.lan2?.subnetMask || '255.255.255.0'),
            lan2Gateway: getValue('routerLan2Gateway', device.interfaces?.lan2?.gateway || '0.0.0.0'),
            lan2Dns: getValue('routerLan2Dns', device.interfaces?.lan2?.dns?.[0] || device.interfaces?.lan2?.ip || '192.168.2.1'),
            lan2Enabled: document.getElementById('routerLan2Enabled')?.checked ?? device.interfaces?.lan2?.enabled ?? true
        };
        
        console.log('[DeviceManager] Router config from UI:', configData);
        
    } else if (device.type === 'dns') {
        configData = {
            ip: getValue('dnsIp', device.ip || '192.168.1.53'),
            subnet: getValue('dnsSubnet', device.subnetMask || '255.255.255.0'),
            gateway: getValue('dnsGateway', device.gateway || '192.168.1.1'),
            dns: getValue('deviceDns', device.dns?.[0] || device.ip || '192.168.1.53')
        };
        
    } else if (device.type === 'switch') {
        const switchIp = getValue('switchIp', device.ip || 'N/A');
        
        // Ειδική λογική για switches
        if (switchIp === '' || switchIp === 'N/A' || !switchIp) {
            // Unmanaged switch - χωρίς IP
            configData = {
                ip: 'N/A',
                subnet: '255.255.255.0',
                gateway: '0.0.0.0',
                dns: []
            };
        } else {
            // Managed switch - με IP
            configData = {
                ip: switchIp,
                subnet: getValue('switchSubnet', device.subnetMask || '255.255.255.0'),
                gateway: getValue('switchGateway', device.gateway || '0.0.0.0'),
                dns: getValue('switchDns', device.dns?.[0] || '8.8.8.8')
            };
        }
        
        console.log('[DeviceManager] Switch config from UI:', configData);
        
    } else {
        // Standard devices (computer, server, printer, cloud)
        configData = {
            ip: getValue('deviceIp', device.ip || '192.168.1.x'),
            subnet: getValue('deviceSubnet', device.subnetMask || '255.255.255.0'),
            gateway: getValue('deviceGateway', device.gateway || '0.0.0.0'),
            dns: getValue('deviceDns', device.dns?.[0] || '8.8.8.8'),
            domainName: getValue('deviceDomain', device.domainName || '')
        };
        
        console.log('[DeviceManager] Standard device config from UI:', configData);
    }
    
    // ΜΟΝΟ ΕΔΩ: Αν όλοι οι έλεγχοι πέρασαν, αποθήκευσε
    try {
        const result = this.updateDeviceConfig(device, configData);
        
        if (result.success) {
            // Εμφάνιση μηνύματος επιτυχίας
            setTimeout(() => {
                alert(`Ενημερώθηκαν επιτυχώς οι ρυθμίσεις για ${device.name}`);
            }, 100);
        }
        
        return result;
    } catch (error) {
        alert(`Σφάλμα: ${error.message}`);
        return { success: false, error: error.message };
    }
}    
    // ΝΕΑ ΜΕΘΟΔΟΣ: Ανάθεση συσκευής σε LAN2
    assignToLAN2(device) {
        if (device.type === 'router') return false;
        
        // Βρες router με LAN2
        const router = this.devices.find(d => d.type === 'router');
        if (!router || !router.interfaces.lan2 || !router.interfaces.lan2.enabled) {
            return false;
        }
        
        // Ορισμός IP στο δίκτυο LAN2
        const lan2IP = router.interfaces.lan2.ip;
        const subnetParts = lan2IP.split('.');
        const baseNetwork = subnetParts.slice(0, 3).join('.');
        
        // Δημιουργία IP στο LAN2 (π.χ. 192.168.2.x)
        let lastOctet = 10;
        let attempts = 0;
        
        while (attempts < 100) {
            const potentialIP = `${baseNetwork}.${lastOctet}`;
            const existingDevice = this.getDeviceByIP(potentialIP);
            
            if (!existingDevice) {
                device.ip = potentialIP;
                device.subnetMask = router.interfaces.lan2.subnetMask;
                device.gateway = router.interfaces.lan2.ip;
                device.dns = router.interfaces.lan2.dns;
                
                // Ενημέρωση εμφάνισης
                if (device.element) {
                    device.element.querySelector('.device-ip').textContent = potentialIP;
                }
                
                return true;
            }
            
            lastOctet++;
            attempts++;
        }
        
        return false;
    }
}

// Εξαγωγή της κλάσης
export default DeviceManager;
