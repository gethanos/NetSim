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
import { isValidIP } from './network-core.js';

// Διαχείριση DNS
class DNSManager {
    constructor() {
        this.globalDnsRecords = {};
        this.initialDnsRecords = {
            'google.com': '8.8.8.8',
            'facebook.com': '31.13.71.36',
            'github.com': '140.82.121.4',
            'example.com': '93.184.216.34'
        };
        
        this.loadDNSRecords();
    }
    
    // Φόρτωση DNS records
    loadDNSRecords() {
        this.globalDnsRecords = { ...this.initialDnsRecords };
        
        // Προσθήκη προκαθορισμένων records
        this.globalDnsRecords['cloud.example.com'] = '8.8.8.8';
        this.globalDnsRecords['fileserver.local'] = '192.168.1.100';
        this.globalDnsRecords['webserver.local'] = '192.168.1.100';
        this.globalDnsRecords['myserver.local'] = '192.168.1.100';
        
        // Προσθήκη περισσότερων παραδειγματικών records
        this.globalDnsRecords['router.local'] = '192.168.1.1';
        this.globalDnsRecords['dns.local'] = '192.168.1.53';
        this.globalDnsRecords['printer.local'] = '192.168.1.50';
        this.globalDnsRecords['nas.local'] = '192.168.1.200';
        this.globalDnsRecords['camera.local'] = '192.168.1.55';
    }
    
    // Βρίσκει τον ρυθμισμένο DNS server μιας συσκευής
    getConfiguredDNSServer(device, deviceManager) {
        // Αν η συσκευή δεν έχει DNS server, ΔΕΝ μπορεί να κάνει DNS query
        if (!device.dns || device.dns.length === 0 || !device.dns[0] || device.dns[0] === '0.0.0.0') {
            this.addLog(`DNS WARNING: Η συσκευή ${device.name} δεν έχει ρυθμισμένο DNS server`, 'warning');
            return null;
        }
        
        const dnsIP = device.dns[0];
        const dnsDevice = deviceManager.getDeviceByIP(dnsIP);
        
        if (dnsDevice) {
            // Έλεγχος αν η συσκευή που βρέθηκε ΜΠΟΡΕΙ να λύσει DNS
            if (this.canResolveDNS(dnsDevice)) {
                return dnsDevice;
            } else {
                this.addLog(`DNS ERROR: Η συσκευή ${dnsDevice.name} (${dnsIP}) δεν είναι DNS server`, 'error');
                return null;
            }
        }
        
        // Αν δεν βρέθηκε συσκευή με αυτό το IP, είναι εξωτερικός DNS (π.χ. 8.8.8.8)
        // Για εξωτερικούς DNS servers, απαιτείται ΧΕΙΡΟΚΙΝΗΤΗ επιλογή
        this.addLog(`DNS INFO: Δεν βρέθηκε συσκευή με IP ${dnsIP} (εξωτερικός DNS)`, 'info');
        return null;
    }
    
    // Έλεγχος αν μια συσκευή μπορεί να λύσει DNS queries
    canResolveDNS(device) {
        return device.type === 'dns' || device.type === 'router';
    }
    
    // DNS resolution
    resolveDNS(domain, sourceDevice, dnsServerDevice = null, deviceManager) {
        // 1. Έλεγχος local cache
        if (sourceDevice.dnsCache && sourceDevice.dnsCache[domain]) {
            return { ip: sourceDevice.dnsCache[domain], source: 'cache', dnsServer: 'cache' };
        }
        
        // 2. Βρες τον DNS server
        let dnsDevice = dnsServerDevice;
        if (!dnsDevice) {
            dnsDevice = this.getConfiguredDNSServer(sourceDevice, deviceManager);
        }
        
        if (!dnsDevice) {
            return null;
        }
        
        // 3. Αν ο DNS server είναι εξωτερικός (δεν υπάρχει στο δίκτυο μας)
        if (!deviceManager.getDeviceByIP(dnsDevice.ip)) {
            // Για εξωτερικούς DNS servers, χρησιμοποιούμε τα global records
            if (this.globalDnsRecords[domain]) {
                return { ip: this.globalDnsRecords[domain], source: 'external-dns', dnsServer: dnsDevice.ip };
            }
            return null;
        }
        
        // 4. Έλεγχος αν το DNS server γνωρίζει να λύσει DNS
        if (!this.canResolveDNS(dnsDevice)) {
            return null;
        }
        
        // 5. Έλεγχος αν το DNS server γνωρίζει το domain
        let resolvedIP = null;
        
        // Έλεγχος global DNS records
        if (this.globalDnsRecords[domain]) {
            resolvedIP = this.globalDnsRecords[domain];
        }
        // Έλεγχος σε κάθε συσκευή για domain name
        else {
            const targetDevice = deviceManager.getDeviceByDomain(domain, this.globalDnsRecords);
            if (targetDevice) {
                resolvedIP = targetDevice.ip;
            }
        }
        
        // 6. Αν βρέθηκε IP, προσομοίωση cache
        if (resolvedIP) {
            if (!sourceDevice.dnsCache) sourceDevice.dnsCache = {};
            sourceDevice.dnsCache[domain] = resolvedIP;
            return { ip: resolvedIP, source: 'dns-server', dnsServer: dnsDevice.name };
        }
        
        return null;
    }
    
    // Προσθήκη DNS record
    addDNSRecord(domain, ip, device = null) {
        if (!isValidIP(ip)) {
            throw new Error('Μη έγκυρη διεύθυνση IP');
        }
        
        if (!domain || domain.trim() === '') {
            throw new Error('Το όνομα domain δεν μπορεί να είναι κενό');
        }
        
        this.globalDnsRecords[domain] = ip;
        
        // Αν δόθηκε συγκεκριμένη συσκευή DNS, προσθήκη και στα τοπικά records
        if (device && device.type === 'dns') {
            if (!device.dnsRecords) device.dnsRecords = {};
            device.dnsRecords[domain] = ip;
        }
        
        return { domain, ip };
    }
    
    // Αφαίρεση DNS record
    removeDNSRecord(domain, device = null) {
        if (this.globalDnsRecords[domain]) {
            delete this.globalDnsRecords[domain];
            
            if (device && device.type === 'dns' && device.dnsRecords && device.dnsRecords[domain]) {
                delete device.dnsRecords[domain];
            }
            
            return true;
        }
        
        return false;
    }
    
    // Εύρεση όλων των DNS records
    getAllDNSRecords() {
        return { ...this.globalDnsRecords };
    }
    
    // Εύρεση όλων των DNS records για display στο UI
    getAllDNSRecordsForDisplay() {
        const records = this.getAllDNSRecords();
        const displayRecords = [];
        
        for (const [domain, ip] of Object.entries(records)) {
            // Προσδιορισμός τύπου record
            let type = 'Custom';
            if (domain.endsWith('.local')) {
                type = 'Local';
            } else if (domain.endsWith('.com') || domain.endsWith('.net') || domain.endsWith('.org') || domain.endsWith('.gr')) {
                type = 'External';
            }
            
            displayRecords.push({
                domain,
                ip,
                type
            });
        }
        
        // Ταξινόμηση για ευανάγνωστο display
        displayRecords.sort((a, b) => {
            if (a.type !== b.type) {
                return a.type.localeCompare(b.type);
            }
            return a.domain.localeCompare(b.domain);
        });
        
        return displayRecords;
    }
    
    // Εύρεση IP για συγκεκριμένο domain
    lookupDomain(domain) {
        return this.globalDnsRecords[domain] || null;
    }
    
    // Διαχείριση DNS cache συσκευών
    clearDeviceDNSCache(device) {
        if (device.dnsCache) {
            device.dnsCache = {};
            return true;
        }
        return false;
    }
    
    // Καθαρισμός όλων των DNS records
    clearAllDNSRecords() {
        this.globalDnsRecords = {};
        return true;
    }
    
    // Νέες μέθοδοι για UI
    testDNSQuery(fromDevice, dnsServerDevice, domain, deviceManager) {
        this.addLog(`DNS QUERY: ${fromDevice.name} → ${dnsServerDevice.name} για "${domain}"`, 'info');
        this.addLog(`Πηγή DNS: ${fromDevice.dns ? fromDevice.dns[0] : 'N/A'}`, 'info');
        
        // 1. Έλεγχος αν ο DNS server μπορεί να λύσει DNS queries
        if (!this.canResolveDNS(dnsServerDevice)) {
            this.addLog(`DNS ERROR: Η συσκευή ${dnsServerDevice.name} δεν είναι DNS server`, 'error');
            return null;
        }
        
        // 2. DNS Resolution
        const resolution = this.resolveDNS(domain, fromDevice, dnsServerDevice, deviceManager);
        
        if (resolution) {
            this.addLog(`DNS RESPONSE: ${domain} → ${resolution.ip} (${resolution.source})`, 'success');
            return resolution;
        } else {
            this.addLog(`DNS QUERY ΑΠΟΤΥΧΙΑ: Το domain "${domain}" δεν βρέθηκε`, 'error');
            return null;
        }
    }
    
    // Προσθήκη DNS record από UI
    addDNSRecordFromUI(dnsDevice, hostInput, ipInput) {
        const host = hostInput.value.trim();
        const ip = ipInput.value.trim();
        
        if (!host || !ip) {
            throw new Error('Παρακαλώ συμπληρώστε και τα δύο πεδία');
        }
        
        const result = this.addDNSRecord(host, ip, dnsDevice);
        
        hostInput.value = '';
        ipInput.value = '';
        
        return result;
    }
    
    // Αφαίρεση DNS record από UI
    removeDNSRecordFromUI(dnsDevice, domain) {
        return this.removeDNSRecord(domain, dnsDevice);
    }
    
    // Ορισμός domain name για συσκευή
    assignDomainName(device, domainNameInput) {
        const domain = domainNameInput.value.trim();
        
        if (!domain) {
            throw new Error('Παρακαλώ εισάγετε ένα domain name');
        }
        
        if (!device.ip || device.ip === 'N/A' || device.ip === '0.0.0.0') {
            throw new Error('Η συσκευή πρέπει να έχει έγκυρη διεύθυνση IP');
        }
        
        // Ενημέρωση συσκευής
        device.domainName = domain;
        
        // Εγγραφή στο DNS
        this.addDNSRecord(domain, device.ip);
        
        return { domain, ip: device.ip };
    }
    
    // Βοηθητική συνάρτηση για logging
    addLog(message, type = 'info') {
        if (typeof window.addLog === 'function') {
         window.addLog(message, type);
        } else {
            console.log(`[DNS ${type.toUpperCase()}] ${message}`);
        }
    // Αυτόματο άνοιγμα κονσόλας μόνο για DNS logs success/error
        if (type === 'success' || type === 'error') {
            if (typeof window.toggleConsole === 'function') {
                const consoleElement = document.getElementById('console');
                if (consoleElement && consoleElement.style.display === 'none') {
                    window.toggleConsole();
                }
            }
        }
    }
    
    // DNS query animation
    visualizeDNSQuery(path, fromDevice, toDevice, domain, type) {
        if (!path || path.length < 2) return;
        
        const workspace = document.getElementById('workspace');
        if (!workspace) return;
        
        const packetId = `dns-${type}-${Date.now()}`;
        const packetEl = document.createElement('div');
        packetEl.className = 'packet-trace';
        packetEl.id = packetId;
        
        if (type === 'query') {
            packetEl.style.backgroundColor = '#ff9800';
            packetEl.style.boxShadow = '0 0 10px #ff9800';
        } else {
            packetEl.style.backgroundColor = '#4caf50';
            packetEl.style.boxShadow = '0 0 10px #4caf50';
        }
        
        workspace.appendChild(packetEl);
        
        this.animatePathSegment(packetEl, path, 0, type === 'query' ? 'DNS Query' : 'DNS Response');
    }
    
    animatePathSegment(packetEl, path, segmentIndex, label) {
        if (!packetEl || !packetEl.parentNode || segmentIndex >= path.length - 1) {
            if (packetEl && packetEl.parentNode) {
                setTimeout(() => {
                    packetEl.remove();
                }, 500);
            }
            return;
        }
        
        const currentDevice = path[segmentIndex];
        const nextDevice = path[segmentIndex + 1];
        
        const startX = currentDevice.x + 60;
        const startY = currentDevice.y + 60;
        const endX = nextDevice.x + 60;
        const endY = nextDevice.y + 60;
        
        packetEl.style.left = `${startX - 9}px`;
        packetEl.style.top = `${startY - 9}px`;
        
        const startTime = Date.now();
        const duration = 800;
        
        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentX = startX + (endX - startX) * progress;
            const currentY = startY + (endY - startY) * progress;
            
            packetEl.style.left = `${currentX - 9}px`;
            packetEl.style.top = `${currentY - 9}px`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                setTimeout(() => {
                    this.animatePathSegment(packetEl, path, segmentIndex + 1, label);
                }, 100);
            }
        };
        
        requestAnimationFrame(animate);
    }
}

// Εξαγωγή της κλάσης
export default DNSManager;
