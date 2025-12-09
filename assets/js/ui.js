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
// Διαχείριση User Interface - ΒΕΛΤΙΩΜΕΝΟ ΓΙΑ COMPACT DESIGN
class UIManager {
    constructor(deviceManager, connectionManager, dnsManager, simulationManager) {
        console.log('[UI CONSTRUCTOR] Creating UIManager instance');
        console.trace('[UI CONSTRUCTOR] Stack trace:');
        this.deviceManager = deviceManager;
        this.connectionManager = connectionManager;
        this.dnsManager = dnsManager;
        this.simulationManager = simulationManager;
        
        // Μεταβλητές κατάστασης UI
        this.connectionMode = false;
        this.testMode = false;
        this.manualDNSMode = false;
        this.firstDeviceForConnection = null;
        this.firstTestDevice = null;
        this.dnsSourceDevice = null;
        
        // DOM Elements - Compact Design
        this.workspace = document.getElementById('workspace');
        this.consoleBody = document.getElementById('consoleBody');
        this.deviceSidebar = document.getElementById('deviceSidebar');
        this.deviceConfigContent = document.getElementById('deviceConfigContent');
        this.connectionModeText = document.getElementById('modeText');
        this.modeIndicator = document.getElementById('connectionMode');
        
        // Αν δεν υπάρχει connectionModeText, δημιουργήστε το
        if (!this.connectionModeText && this.modeIndicator) {
            this.connectionModeText = this.modeIndicator.querySelector('span');
        }
        
        // Log panel για συμβατότητα
        this.logPanel = document.getElementById('logPanel');
        if (!this.logPanel) {
            this.createFallbackLogPanel();
        }
        
        // Buttons - Compact Design
        this.buttons = {
            clear: this.getSafeElement('clearBtn'),
            connect: this.getSafeElement('connectBtn'),
            simulate: this.getSafeElement('simulateBtn'),
            testPing: this.getSafeElement('testPingBtn'),
            testRoute: this.getSafeElement('testRouteBtn'),
            testDNS: this.getSafeElement('testDNSBtn'),
            manualDNS: this.getSafeElement('manualDNSBtn'),
            addLan: this.getSafeElement('addLanBtn'),
            addWan: this.getSafeElement('addWanBtn'),
            debug: this.getSafeElement('debugBtn'),
            autoRoute: this.getSafeElement('autoRouteBtn')
        };
        
        // Ενημέρωση κουμπιών simulation
        this.updateSimulationButton();
        
        console.log('[UI Compact] Initialized with new design');
    }
    
    // Βοηθητική μέθοδος για ασφαλή λήψη στοιχείων
    getSafeElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`[UI] Element not found: ${id}`);
        }
        return element;
    }
    
    // Δημιουργία fallback log panel αν λείπει
    createFallbackLogPanel() {
        const consoleBody = document.getElementById('consoleBody');
        if (consoleBody) {
            this.logPanel = consoleBody;
            return;
        }
        
        console.warn('[UI] No console body found for fallback log');
    }
    
    // Αρχικοποίηση event listeners για compact design
    initializeEventListeners() {
        // DEBUG: Παρακολούθηση πόσες φορές καλείται
        if (!window.initializeEventListenersCount) {
            window.initializeEventListenersCount = 0;
        }
        window.initializeEventListenersCount++;
        console.error(`[DEBUG] initializeEventListeners called ${window.initializeEventListenersCount} times!`);
        console.trace('[UI INIT] Stack trace:');
        
        // Εάν έχουν ήδη προστεθεί listeners, ΜΗΝ ξαναπροσθέσεις
        if (this._listenersInitialized) {
            console.warn('[UI] ⚠️ Event listeners ALREADY initialized! Skipping...');
            return;
        }
        this._listenersInitialized = true;
        
        console.log('[UI] ✅ Initializing event listeners for the FIRST time');
        
        // Προσθήκη συσκευών από τα compact device cards
        const deviceCards = document.querySelectorAll('.device-card');
        if (deviceCards.length > 0) {
            deviceCards.forEach(card => {
                card.addEventListener('click', () => {
                    const type = card.dataset.type;
                    const color = card.dataset.color;
                    this.addDeviceToWorkspace(type, color);
                });
            });
            console.log(`[UI] Added ${deviceCards.length} device card listeners`);
        }
        
        // Event Listeners για κουμπιά ελέγχου
        this.setupButtonListeners();
        
        // Κλικ έξω από συσκευή για αποεπιλογή
        if (this.workspace) {
            this.workspace.addEventListener('click', (e) => {
                if (e.target === this.workspace && 
                    !this.connectionMode && !this.testMode && 
                    !this.manualDNSMode) {
                    
                    if (this.deviceManager.selectedDevice) {
                        this.deselectCurrentDevice();
                        this.closeDevicePanel();
                    }
                }
            });
            console.log('[UI] Workspace click listener added');
        }
        
        // Keyboard shortcuts
        this.setupKeyboardShortcuts();
    }
    
    // Ρύθμιση ακροατών για compact buttons
    setupButtonListeners() {
        console.log('[UI DEBUG] setupButtonListeners called');
        console.trace();
        
        // ΕΑΝ ΈΧΟΥΝ ΗΔΗ ΠΡΟΣΤΕΘΕΙ LISTENERS, ΜΗΝ ΞΑΝΑΠΡΟΣΘΕΣΕΙΣ!
        if (this._buttonListenersInitialized) {
            console.warn('[UI] ⚠️ Button listeners already initialized! Skipping...');
            return;
        }
        this._buttonListenersInitialized = true;
        
        const buttonConfigs = [
            { button: this.buttons.clear, handler: () => this.clearWorkspace(), name: 'clear' },
            { button: this.buttons.connect, handler: () => this.toggleConnectionMode(), name: 'connect' },
            { button: this.buttons.simulate, handler: () => this.toggleSimulation(), name: 'simulate' },
            { button: this.buttons.testPing, handler: () => this.testPingBetweenDevices(), name: 'testPing' },
            { button: this.buttons.testRoute, handler: () => this.toggleTestMode(), name: 'testRoute' },
            { button: this.buttons.testDNS, handler: () => this.testAutoDNS(), name: 'testDNS' },
            { button: this.buttons.manualDNS, handler: () => this.toggleManualDNSMode(), name: 'manualDNS' },
            { button: this.buttons.addLan, handler: () => this.createPredefinedLan(), name: 'addLan' },
            { button: this.buttons.addWan, handler: () => this.createPredefinedWan(), name: 'addWan' },
            { button: this.buttons.debug, handler: () => this.debugInfo(), name: 'debug' },
            { button: this.buttons.autoRoute, handler: () => this.autoConfigureRouting(), name: 'autoRoute' }
        ];
        
        let addedCount = 0;
        buttonConfigs.forEach(config => {
            if (config.button) {
                // ΧΩΡΙΣ cloneNode! Απλά πρόσθεσε τον listener
                const handler = (e) => {
                    console.log(`[BUTTON] ${config.name} clicked (single handler)`);
                    e.stopImmediatePropagation();  // ΣΤΑΜΑΤΑ άμεσα την προπαραγωγή
                    e.preventDefault();  // Αποτροπή default behavior
                    config.handler();
                };
                
                // Προσθήκη ΜΟΝΟ ενός listener
                config.button.addEventListener('click', handler);
                addedCount++;
                
                console.log(`[UI] ✅ Added listener to ${config.name}`);
            }
        });
        
        console.log(`[UI] ✅ Added ${addedCount} button listeners (NO cloning)`);
    }
    
    // Προσθήκη συσκευής στο workspace (compact version)
    addDeviceToWorkspace(type, color) {
        if (!this.workspace) {
            this.addLog('Πρόβλημα: Το workspace δεν βρέθηκε', 'error');
            return null;
        }
        
        const workspaceRect = this.workspace.getBoundingClientRect();
        const x = Math.random() * (workspaceRect.width - 100) + 25;
        const y = Math.random() * (workspaceRect.height - 100) + 25;
        
        try {
            const device = this.deviceManager.addDevice(type, color, x, y, this.workspace);
            this.addLog(`Προστέθηκε συσκευή: ${device.name}`, 'success');
            
            // Add "new" animation class
            device.element.classList.add('new');
            setTimeout(() => device.element.classList.remove('new'), 400);
            
            // Ενημέρωση στατιστικών
            this.updateNetworkStats();
            
            return device;
        } catch (error) {
            this.addLog(`Σφάλμα προσθήκης συσκευής: ${error.message}`, 'error');
            return null;
        }
    }
    

// Ενημέρωση πληροφορίες συσκευής (στο sidebar)
updateDeviceInfo(device) {
    if (!this.deviceConfigContent) {
        console.warn('[UI] Device config content not found');
        return;
    }
    
    if (!device) {
        this.deviceConfigContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-mouse-pointer"></i>
                <p>Κάντε κλικ σε μια συσκευή για να δείτε τις πληροφορίες της</p>
            </div>
        `;
        return;
    }
    
    // Άνοιγμα του sidebar
    this.showDevicePanel();
    
    // Δημιουργία πληροφοριών συσκευής
    let deviceTypeText = '';
    switch(device.type) {
        case 'router': deviceTypeText = 'Router (Δρομολογητής)'; break;
        case 'switch': deviceTypeText = 'Switch (Μεταγωγέας)'; break;
        case 'computer': deviceTypeText = 'Υπολογιστής'; break;
        case 'server': deviceTypeText = 'Εξυπηρετητής'; break;
        case 'cloud': deviceTypeText = 'Cloud (WAN)'; break;
        case 'printer': deviceTypeText = 'Εκτυπωτής'; break;
        case 'dns': deviceTypeText = 'DNS Server'; break;
    }

    // Χρήση connectionManager - ΕΙΝΑΙ το authoritative source για τις συνδέσεις!
    const hasConnections = this.connectionManager.connections
        .some(conn => conn.device1Id === device.id || conn.device2Id === device.id);

    const statusText = (device.status === 'online' && hasConnections) ? 'Συνδεδεμένο' : 'Ασύνδετο';
    const statusClass = (device.status === 'online' && hasConnections) ? 'status-online' : 'status-offline';

    // Number of active connections
    const connectionCount = this.connectionManager.connections
        .filter(conn => conn.device1Id === device.id || conn.device2Id === device.id).length;

    let infoHTML = `
        <div class="config-panel">
            <h4>Βασικές Πληροφορίες</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div>
                    <strong>Όνομα:</strong><br>
                    <span style="font-size: 0.9rem;">${device.name}</span>
                </div>
                <div>
                    <strong>Τύπος:</strong><br>
                    <span style="font-size: 0.9rem;">${deviceTypeText}</span>
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div>
                    <strong>Κατάσταση:</strong><br>
                    <span class="status-badge ${statusClass}" style="font-size: 0.8rem;">
                        <i class="fas fa-circle"></i> ${statusText}
                    </span>
                </div>
                <div>
                    <strong>Συνδέσεις:</strong><br>
                    <span style="font-size: 0.9rem;">${connectionCount}</span>
                </div>
            </div>
        </div>
    `;
    
    if (device.type === 'router') {
        infoHTML += this.generateRouterConfigHTML(device);
    } else if (device.type === 'dns') {
        infoHTML += this.generateDNSConfigHTML(device);
    } else if (device.type === 'switch') {
        infoHTML += this.generateSwitchConfigHTML(device);
    } else {
        infoHTML += this.generateStandardConfigHTML(device);
    }
    
    // Connection list
    if (connectionCount > 0 && device.connections && device.connections.length > 0) {
        infoHTML += this.generateConnectionsListHTML(device);
    }
    
    // Action buttons
    infoHTML += `
        <div class="form-actions">
            <button class="btn btn-danger" id="removeDeviceBtn">
                <i class="fas fa-trash-alt"></i> Διαγραφή
            </button>
            <button class="btn btn-primary" id="testDeviceBtn">
                <i class="fas fa-vial"></i> Δοκιμές
            </button>
        </div>
    `;
    
    // Set the HTML
    this.deviceConfigContent.innerHTML = infoHTML;
    
    // FIXED: Use Promise for better cross-browser compatibility
    Promise.resolve().then(() => {
        this.addDeviceConfigEventListeners(device);
    }).catch(error => {
        console.error('[UI] Error in Promise:', error);
        // Fallback to setTimeout
        setTimeout(() => {
            this.addDeviceConfigEventListeners(device);
        }, 0);
    });
    
    return device; // Return the device for chaining
}
    // Δημιουργία HTML για router configuration
    generateRouterConfigHTML(router) {
        return `
            <div class="config-panel">
                <h4><i class="fas fa-wifi"></i> Ρυθμίσεις Router</h4>
                <div class="form-group">
                    <label for="routerWanIp">WAN IP:</label>
                    <input type="text" id="routerWanIp" value="${router.interfaces.wan.ip}" placeholder="203.0.113.1">
                </div>
                <div class="form-group">
                    <label for="routerLanIp">LAN IP:</label>
                    <input type="text" id="routerLanIp" value="${router.interfaces.lan.ip}" placeholder="192.168.1.1">
                </div>
                <div class="form-group">
                    <label for="routerSubnet">Subnet Mask:</label>
                    <input type="text" id="routerSubnet" value="${router.interfaces.lan.subnetMask}" placeholder="255.255.255.0">
                </div>
                <button class="btn btn-success" id="updateRouterBtn" style="width: 100%;">
                    <i class="fas fa-save"></i> Ενημέρωση
                </button>
            </div>
        `;
    }
    
    // Δημιουργία HTML για DNS configuration
    generateDNSConfigHTML(dnsDevice) {
        const dnsRecords = this.dnsManager.getAllDNSRecordsForDisplay();
        
        let dnsRecordsHTML = '';
        if (dnsRecords.length > 0) {
            dnsRecordsHTML = dnsRecords.map(record => {
                const typeClass = record.type === 'Local' ? 'local' : 
                                 record.type === 'External' ? 'external' : 'custom';
                return `
                    <div class="dns-record ${typeClass}">
                        <div class="dns-record-info">
                            <div class="dns-domain">${record.domain}</div>
                            <div class="dns-ip">${record.ip}</div>
                        </div>
                        <button class="btn btn-sm btn-danger delete-dns-record" data-domain="${record.domain}">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                `;
            }).join('');
        } else {
            dnsRecordsHTML = '<div style="text-align: center; padding: 20px; color: #6c757d;">Δεν υπάρχουν DNS records</div>';
        }
        
        return `
            <div class="config-panel">
                <h4><i class="fas fa-search"></i> Ρυθμίσεις DNS</h4>
                <div class="form-group">
                    <label for="dnsIp">Διεύθυνση IP:</label>
                    <input type="text" id="dnsIp" value="${dnsDevice.ip}" placeholder="192.168.1.53">
                </div>
                <div class="form-group">
                    <label for="dnsGateway">Gateway:</label>
                    <input type="text" id="dnsGateway" value="${dnsDevice.gateway}" placeholder="192.168.1.1">
                </div>
                
                <div style="margin-top: 20px;">
                    <h5 style="margin-bottom: 10px;">DNS Records</h5>
                    <div style="max-height: 200px; overflow-y: auto; margin-bottom: 15px;">
                        ${dnsRecordsHTML}
                    </div>
                    
                    <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px;">
                        <div>
                            <input type="text" id="newDnsDomain" placeholder="example.com" style="width: 100%; padding: 6px;">
                        </div>
                        <div>
                            <input type="text" id="newDnsIp" placeholder="192.168.1.100" style="width: 100%; padding: 6px;">
                        </div>
                        <div>
                            <button class="btn btn-success" id="addDnsRecordBtn">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
                
                <button class="btn btn-success" id="updateDnsBtn" style="width: 100%; margin-top: 15px;">
                    <i class="fas fa-save"></i> Ενημέρωση
                </button>
            </div>
        `;
    }
    
    // Δημιουργία HTML για switch configuration
    generateSwitchConfigHTML(switchDevice) {
        return `
            <div class="config-panel">
                <h4><i class="fas fa-network-wired"></i> Ρυθμίσεις Switch</h4>
                <div class="form-group">
                    <label for="switchIp">Διεύθυνση IP (managed):</label>
                    <input type="text" id="switchIp" value="${switchDevice.ip}" placeholder="192.168.1.254">
                </div>
                <div class="form-group">
                    <label for="switchSubnet">Subnet Mask:</label>
                    <input type="text" id="switchSubnet" value="${switchDevice.subnetMask}" placeholder="255.255.255.0">
                </div>
                <button class="btn btn-success" id="updateSwitchBtn" style="width: 100%;">
                    <i class="fas fa-save"></i> Ενημέρωση
                </button>
            </div>
        `;
    }
    
    // Δημιουργία HTML για τυπική συσκευή
    generateStandardConfigHTML(device) {
        return `
            <div class="config-panel">
                <h4><i class="fas fa-cog"></i> Ρυθμίσεις Δικτύου</h4>
                <div class="form-group">
                    <label for="deviceIp">Διεύθυνση IP:</label>
                    <input type="text" id="deviceIp" value="${device.ip}" placeholder="192.168.1.10">
                </div>
                <div class="form-group">
                    <label for="deviceSubnet">Subnet Mask:</label>
                    <input type="text" id="deviceSubnet" value="${device.subnetMask}" placeholder="255.255.255.0">
                </div>
                <div class="form-group">
                    <label for="deviceGateway">Gateway:</label>
                    <input type="text" id="deviceGateway" value="${device.gateway}" placeholder="192.168.1.1">
                </div>
                <div class="form-group">
                    <label for="deviceDns">DNS Server:</label>
                    <input type="text" id="deviceDns" value="${device.dns?.[0] || ''}" placeholder="192.168.1.53">
                </div>
                <div class="form-group">
                    <label for="deviceDomain">Domain Name:</label>
                    <input type="text" id="deviceDomain" value="${device.domainName || ''}" placeholder="server1.local">
                </div>
                <button class="btn btn-success" id="updateDeviceBtn" style="width: 100%;">
                    <i class="fas fa-save"></i> Ενημέρωση
                </button>
            </div>
            
            <div class="config-panel">
                <h4><i class="fas fa-vial"></i> Γρήγορες Δοκιμές</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                    <button class="btn btn-primary" id="quickPingBtn">
                        <i class="fas fa-satellite-dish"></i> Ping
                    </button>
                    <button class="btn btn-info" id="quickRouteBtn">
                        <i class="fas fa-route"></i> Διαδρομή
                    </button>
                    <button class="btn btn-warning" id="quickDNSBtn">
                        <i class="fas fa-search"></i> DNS
                    </button>
                    <button class="btn btn-info" id="quickManualDNSBtn">
                        <i class="fas fa-hand-pointer"></i> Χειροκίνητο
                    </button>
                </div>
            </div>
        `;
    }
    
    // Δημιουργία HTML για λίστα συνδέσεων
    generateConnectionsListHTML(device) {
        if (!device.connections || !Array.isArray(device.connections)) {
            return '';
        }
        
        let connectionsHTML = device.connections.map(connId => {
            const conn = this.connectionManager.connections.find(c => c.id === connId);
            if (!conn) return '';
            
            const otherDeviceId = conn.device1Id === device.id ? conn.device2Id : conn.device1Id;
            const otherDevice = this.deviceManager.getDeviceById(otherDeviceId);
            if (!otherDevice) return '';
            
            const directComm = this.connectionManager.canDevicesCommunicateDirectly(device, otherDevice);
            const connType = directComm.viaGateway ? 'Μέσω Gateway' : 'Άμεση';
            const connClass = directComm.canCommunicate ? 
                (directComm.viaGateway ? 'info' : 'success') : 'danger';
            
            return `
                <div class="connection-item">
                    <div class="connection-info">
                        <div class="connection-name">${otherDevice.name}</div>
                        <div class="connection-type">
                            <span class="status-badge status-${connClass}">${connType}</span>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-danger delete-connection" data-connection-id="${conn.id}">
                        <i class="fas fa-unlink"></i>
                    </button>
                </div>
            `;
        }).filter(html => html !== '').join('');
        
        if (!connectionsHTML) return '';
        
        return `
            <div class="config-panel">
                <h4><i class="fas fa-link"></i> Συνδέσεις</h4>
                <div class="connection-list">
                    ${connectionsHTML}
                </div>
            </div>
        `;
    }
    
// Προσθήκη event listeners στα στοιχεία διαμόρφωσης
addDeviceConfigEventListeners(device) {
    console.log(`[UI] Setting up config listeners for ${device.name}`);
    
    // Helper function to safely add event listener
    const safeAddListener = (elementId, event, handler) => {
        const element = document.getElementById(elementId);
        if (element) {
            // Clone element to remove old listeners (fix for Safari/Firefox)
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
            
            // Get the new element and add listener
            const updatedElement = document.getElementById(elementId);
            if (updatedElement) {
                updatedElement.addEventListener(event, handler);
                return true;
            }
        }
        return false;
    };
    
    // Remove device button
    if (!safeAddListener('removeDeviceBtn', 'click', () => {
        if (confirm(`Θέλετε να αφαιρέσετε τη συσκευή ${device.name};`)) {
            this.removeDevice(device);
            this.closeDevicePanel();
        }
    })) {
        console.warn(`[UI] removeDeviceBtn not found for ${device.name}`);
    }
    
    // Test device button
    if (!safeAddListener('testDeviceBtn', 'click', () => {
        this.showTestMenu(device);
    })) {
        console.warn(`[UI] testDeviceBtn not found for ${device.name}`);
    }
    
    // Quick test buttons
    ['quickPingBtn', 'quickRouteBtn', 'quickDNSBtn', 'quickManualDNSBtn'].forEach(btnId => {
        if (!safeAddListener(btnId, 'click', () => {
            this.handleQuickTest(device, btnId);
        })) {
            // Don't warn for quick buttons - they might not exist for all device types
        }
    });
    
    // Update buttons based on device type
    if (device.type === 'router') {
        if (!safeAddListener('updateRouterBtn', 'click', () => {
            this.updateRouterConfig(device);
        })) {
            console.warn(`[UI] updateRouterBtn not found for router ${device.name}`);
        }
    } else if (device.type === 'dns') {
        if (!safeAddListener('updateDnsBtn', 'click', () => {
            this.updateDNSConfig(device);
        })) {
            console.warn(`[UI] updateDnsBtn not found for DNS ${device.name}`);
        }
        
        // Add DNS record button - with null checks
        const addDnsBtn = document.getElementById('addDnsRecordBtn');
        if (addDnsBtn) {
            // Clone to remove old listeners
            const newAddDnsBtn = addDnsBtn.cloneNode(true);
            addDnsBtn.parentNode.replaceChild(newAddDnsBtn, addDnsBtn);
            
            document.getElementById('addDnsRecordBtn').addEventListener('click', () => {
                this.addDNSRecordFromUI(device);
            });
        } else {
            console.warn(`[UI] addDnsRecordBtn not found for DNS ${device.name}`);
        }
        
        // Delete DNS record buttons
        setTimeout(() => {
            document.querySelectorAll('.delete-dns-record').forEach(btn => {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                
                newBtn.addEventListener('click', (e) => {
                    const domain = newBtn.dataset.domain;
                    this.removeDNSRecord(device, domain);
                });
            });
        }, 100);
    } else if (device.type === 'switch') {
        if (!safeAddListener('updateSwitchBtn', 'click', () => {
            this.updateDeviceConfig(device);
        })) {
            console.warn(`[UI] updateSwitchBtn not found for switch ${device.name}`);
        }
    } else {
        if (!safeAddListener('updateDeviceBtn', 'click', () => {
            this.updateDeviceConfig(device);
        })) {
            console.warn(`[UI] updateDeviceBtn not found for ${device.type} ${device.name}`);
        }
    }
    
    // Delete connection buttons
    setTimeout(() => {
        document.querySelectorAll('.delete-connection').forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', (e) => {
                const connId = newBtn.dataset.connectionId;
                this.removeConnectionById(connId);
                this.updateDeviceInfo(device);
            });
        });
    }, 100);
}
    
    // Χειρισμός γρήγορων δοκιμών
    handleQuickTest(device, buttonId) {
        switch(buttonId) {
            case 'quickPingBtn':
                this.testPingFromDevice(device);
                break;
            case 'quickRouteBtn':
                this.testRouteFromDevice(device);
                break;
            case 'quickDNSBtn':
                this.testAutoDNSFromDevice(device);
                break;
            case 'quickManualDNSBtn':
                this.testManualDNSFromDevice(device);
                break;
        }
    }
    
    // Εμφάνιση μενού δοκιμών
    showTestMenu(device) {
        const menuHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; align-items: center; justify-content: center;">
                <div style="background: white; padding: 20px; border-radius: 8px; max-width: 400px; width: 90%;">
                    <h4 style="margin-bottom: 15px;">Δοκιμές από ${device.name}</h4>
                    <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
                        <button class="btn btn-primary" id="menuPingBtn">
                            <i class="fas fa-satellite-dish"></i> Δοκιμή Ping
                        </button>
                        <button class="btn btn-info" id="menuRouteBtn">
                            <i class="fas fa-route"></i> Δοκιμή Διαδρομής
                        </button>
                        <button class="btn btn-warning" id="menuDNSBtn">
                            <i class="fas fa-search"></i> Αυτόματο DNS
                        </button>
                        <button class="btn btn-info" id="menuManualDNSBtn">
                            <i class="fas fa-hand-pointer"></i> Χειροκίνητο DNS
                        </button>
                        <button class="btn btn-secondary" id="menuCancelBtn">
                            <i class="fas fa-times"></i> Ακύρωση
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        const menuDiv = document.createElement('div');
        menuDiv.innerHTML = menuHTML;
        document.body.appendChild(menuDiv);
        
        // Add event listeners
        document.getElementById('menuPingBtn').addEventListener('click', () => {
            menuDiv.remove();
            this.testPingFromDevice(device);
        });
        
        document.getElementById('menuRouteBtn').addEventListener('click', () => {
            menuDiv.remove();
            this.testRouteFromDevice(device);
        });
        
        document.getElementById('menuDNSBtn').addEventListener('click', () => {
            menuDiv.remove();
            this.testAutoDNSFromDevice(device);
        });
        
        document.getElementById('menuManualDNSBtn').addEventListener('click', () => {
            menuDiv.remove();
            this.testManualDNSFromDevice(device);
        });
        
        document.getElementById('menuCancelBtn').addEventListener('click', () => {
            menuDiv.remove();
        });
        
        // Close on background click
        menuDiv.querySelector('div > div').addEventListener('click', (e) => e.stopPropagation());
        menuDiv.addEventListener('click', () => menuDiv.remove());
    }
    
    // Χειρισμός κλικ σε συσκευή
    handleDeviceClick(device) {
        console.log(`[UI] Device clicked: ${device.name}`);
        
        if (this.connectionMode) {
            this.handleConnectionClick(device);
        } else if (this.testMode) {
            this.handleTestModeClick(device);
        } else if (this.manualDNSMode) {
            this.handleManualDNSModeClick(device);
        } else {
            this.selectDevice(device);
        }
    }
    
    // Επιλογή συσκευής
    selectDevice(device) {
        // Deselect current device
        this.deselectCurrentDevice();
        
        // Select new device
        this.deviceManager.selectedDevice = device;
        device.element.classList.add('selected');
        
        // Show device panel
        this.showDevicePanel();
        this.updateDeviceInfo(device);
        
        this.addLog(`Επιλέχθηκε συσκευή: ${device.name}`, 'info');
    }
    
    // Αποεπιλογή τρέχουσας συσκευής
    deselectCurrentDevice() {
        if (this.deviceManager.selectedDevice) {
            this.deviceManager.selectedDevice.element.classList.remove('selected');
            this.deviceManager.selectedDevice = null;
        }
    }
    
    // Άνοιγμα device panel
    showDevicePanel() {
        if (this.deviceSidebar) {
            this.deviceSidebar.classList.add('active');
        }
    }
    
    // Κλείσιμο device panel
    closeDevicePanel() {
        if (this.deviceSidebar) {
            this.deviceSidebar.classList.remove('active');
        }
        this.deselectCurrentDevice();
    }
    
    // Χειρισμός κλικ σε λειτουργία σύνδεσης
    handleConnectionClick(device) {
        if (this.firstDeviceForConnection === null) {
            this.firstDeviceForConnection = device;
            device.element.classList.add('connect-mode');
            this.setModeText(`Επιλέξτε δεύτερη συσκευή για σύνδεση`);
            this.addLog(`Επιλέχθηκε πρώτη συσκευή: ${device.name}`, 'info');
        } else if (this.firstDeviceForConnection.id === device.id) {
            device.element.classList.remove('connect-mode');
            this.firstDeviceForConnection = null;
            this.setModeText(`Επιλέξτε πρώτη συσκευή`);
            this.addLog('Ακυρώθηκε η σύνδεση', 'info');
        } else {
            try {
                this.connectionManager.createConnection(this.firstDeviceForConnection, device);
                this.connectionManager.updateAllConnections(this.deviceManager.devices);
                
                this.firstDeviceForConnection.element.classList.remove('connect-mode');
                this.firstDeviceForConnection = null;
                this.connectionMode = false;
                if (this.buttons.connect) this.buttons.connect.classList.remove('active');
                this.setModeText(`Επιλογή Συσκευών`);
                this.selectDevice(device);
                
                // Ενημέρωση στατιστικών
                this.updateNetworkStats();
            } catch (error) {
                this.addLog(error.message, 'error');
                if (typeof window.addToConsole === 'function') {
                    window.addToConsole(error.message, 'error');
                }
            }
        }
    }
    
    // Χειρισμός κλικ σε λειτουργία δοκιμής
    handleTestModeClick(device) {
        if (this.firstTestDevice === null) {
            this.firstTestDevice = device;
            device.element.classList.add('test-mode');
            this.setModeText(`Επιλέξτε 2η συσκευή για δοκιμή από ${device.name}`);
            this.addLog(`Επιλέχθηκε πρώτη συσκευή για δοκιμή: ${device.name}`, 'info');
        } else if (this.firstTestDevice.id === device.id) {
            device.element.classList.remove('test-mode');
            this.firstTestDevice = null;
            this.testMode = false;
            if (this.buttons.testRoute) this.buttons.testRoute.classList.remove('active');
            this.setModeText(`Επιλογή Συσκευών`);
            this.addLog('Ακυρώθηκε η δοκιμή διαδρομής', 'info');
        } else {
            this.testCommunicationBetween(this.firstTestDevice, device);
            
            this.firstTestDevice.element.classList.remove('test-mode');
            this.firstTestDevice = null;
            this.testMode = false;
            if (this.buttons.testRoute) this.buttons.testRoute.classList.remove('active');
            this.setModeText(`Επιλογή Συσκευών`);
            
            this.selectDevice(device);
        }
    }
    
    // Χειρισμός κλικ σε χειροκίνητο DNS
    handleManualDNSModeClick(device) {
        if (this.dnsSourceDevice === null) {
            this.dnsSourceDevice = device;
            device.element.classList.add('dns-source-mode');
            this.setModeText(`Επιλέξτε DNS Server`);
            this.addLog(`Επιλέχθηκε πηγή: ${device.name}`, 'info');
        } 
        else if (this.dnsSourceDevice.id === device.id) {
            device.element.classList.remove('dns-source-mode');
            this.dnsSourceDevice = null;
            this.manualDNSMode = false;
            if (this.buttons.manualDNS) this.buttons.manualDNS.classList.remove('active');
            this.setModeText(`Επιλογή Συσκευών`);
            this.addLog('Ακυρώθηκε η χειροκίνητη δοκιμή DNS', 'info');
        }
        else {
            if (!this.dnsManager.canResolveDNS(device)) {
                const message = `Σφάλμα: Η συσκευή ${device.name} δεν είναι DNS server!`;
                this.addLog(message, 'error');
                
                if (typeof window.addToConsole === 'function') {
                    window.addToConsole(message, 'error');
                } else {
                    alert(message);
                }
                return;
            }
            
            const sourceDevice = this.dnsSourceDevice;
            const dnsServerDevice = device;
            
            sourceDevice.element.classList.remove('dns-source-mode');
            this.dnsSourceDevice = null;
            this.manualDNSMode = false;
            if (this.buttons.manualDNS) this.buttons.manualDNS.classList.remove('active');
            this.setModeText(`Επιλογή Συσκευών`);
            
            this.selectDevice(dnsServerDevice);
            
            setTimeout(() => {
                const availableDomains = Object.keys(this.dnsManager.globalDnsRecords);
                let domainList = '';
                
                if (availableDomains.length > 0) {
                    domainList = `\n\nΔιαθέσιμα domains:\n${availableDomains.map(d => `• ${d}`).join('\n')}`;
                }
                
                const domain = prompt(
                    `DNS query από ${sourceDevice.name}:\n` +
                    `DNS Server: ${dnsServerDevice.name}\n` +
                    domainList +
                    `\n\nΕισάγετε domain:`
                );
                
                if (domain && domain.trim() !== '') {
                    const resolvedIP = this.testDNSQuery(sourceDevice, dnsServerDevice, domain.trim());
                    
                    if (resolvedIP && resolvedIP.ip) {
                        setTimeout(() => {
                            const targetDevice = this.deviceManager.getDeviceByIP(resolvedIP.ip);
                            if (targetDevice) {
                                this.addLog(`DNS ΕΠΙΤΥΧΙΑ: ${domain} → ${resolvedIP.ip} (${targetDevice.name})`, 'success');
                                this.testCommunicationBetween(sourceDevice, targetDevice);
                            }
                        }, 1500);
                    }
                }
            }, 50);
        }
    }
    
    // Ενημέρωση κειμένου κατάστασης
    setModeText(text) {
        if (this.connectionModeText) {
            this.connectionModeText.textContent = text;
        }
    }
    
    // Προσθήκη μηνύματος στο log
    addLog(message, type = 'info') {
        // DEBUG: Παρακολούθηση προέλευσης
        console.trace(`[LOG SOURCE] Called with: ${message.substring(0, 50)}...`);
        // Προσθήκη στην κονσόλα
        //if (typeof window.addToConsole === 'function') {
        //    window.addToConsole(message, type);
        //}
        
        // Προσθήκη στο παλιό log panel για συμβατότητα
        if (this.logPanel) {
            try {
                const logEntry = document.createElement('div');
                logEntry.className = `log-message ${type}`;
                logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
                this.logPanel.appendChild(logEntry);
                this.logPanel.scrollTop = this.logPanel.scrollHeight;
            } catch (error) {
                console.error('[UI] Error in addLog:', error);
            }
        }
        
        // Εμφάνιση στην κονσόλα αν είναι κλειστή
        this.showConsoleIfError(type);
    }
    
    // Εμφάνιση κονσόλας για σημαντικά μηνύματα
    showConsoleIfError(type) {
        if (type === 'error' && typeof window.toggleConsole === 'function') {
            const console = document.getElementById('console');
            if (console && console.style.display === 'none') {
                // Ανοίγουμε την κονσόλα για errors
                window.toggleConsole();
            }
        }
    }
    
    // Συναρτήσεις εναλλαγής κατάστασης
    toggleConnectionMode() {
        this.connectionMode = !this.connectionMode;
        
        if (this.connectionMode) {
            this.setModeText(`Επιλέξτε πρώτη συσκευή`);
            if (this.buttons.connect) {
                this.buttons.connect.classList.add('primary');
            }
            this.addLog('Λειτουργία σύνδεσης ενεργοποιήθηκε', 'info');
            
            // Ακύρωσε ΟΛΟΥΣ εκτός από connection mode
            this.cancelOtherModes('connection');
            
            this.closeDevicePanel();
            this.firstDeviceForConnection = null;
        } else {
            this.setModeText(`Επιλογή Συσκευών`);
            if (this.buttons.connect) {
                this.buttons.connect.classList.remove('primary');
            }
            
            if (this.firstDeviceForConnection) {
                this.firstDeviceForConnection.element.classList.remove('connect-mode');
                this.firstDeviceForConnection = null;
            }
        }
    }

    toggleTestMode() {
        this.testMode = !this.testMode;
        
        if (this.testMode) {
            this.setModeText(`Επιλέξτε 1η συσκευή`);
            if (this.buttons.testRoute) this.buttons.testRoute.classList.add('primary');
            this.addLog('Λειτουργία δοκιμής διαδρομής ενεργοποιήθηκε', 'info');
            
            // Ακύρωσε ΟΛΟΥΣ εκτός από test mode
            this.cancelOtherModes('test');
            
            this.closeDevicePanel();
            this.firstTestDevice = null;
        } else {
            if (this.buttons.testRoute) this.buttons.testRoute.classList.remove('primary');
            this.setModeText(`Επιλογή Συσκευών`);
            
            if (this.firstTestDevice) {
                this.firstTestDevice.element.classList.remove('test-mode');
                this.firstTestDevice = null;
            }
        }
    }

    toggleManualDNSMode() {
        this.manualDNSMode = !this.manualDNSMode;
        
        if (this.manualDNSMode) {
            this.setModeText(`Επιλέξτε πηγή για DNS query`);
            if (this.buttons.manualDNS) this.buttons.manualDNS.classList.add('primary');
            this.addLog('Χειροκίνητη λειτουργία DNS ενεργοποιήθηκε', 'info');
            
            // Ακύρωσε ΟΛΟΥΣ εκτός από dns mode
            this.cancelOtherModes('dns');
            
            this.closeDevicePanel();
            this.dnsSourceDevice = null;
        } else {
            if (this.buttons.manualDNS) this.buttons.manualDNS.classList.remove('primary');
            this.setModeText(`Επιλογή Συσκευών`);
            
            if (this.dnsSourceDevice) {
                this.dnsSourceDevice.element.classList.remove('dns-source-mode');
                this.dnsSourceDevice = null;
            }
        }
    }
    
    // Ακύρωση άλλων λειτουργιών
    cancelOtherModes(excludeMode = null) {
        // excludeMode: 'connection', 'test', 'dns', ή null για όλες
        if (excludeMode !== 'connection' && this.connectionMode) {
            this.connectionMode = false;
            if (this.buttons.connect) this.buttons.connect.classList.remove('primary');
            if (this.firstDeviceForConnection) {
                this.firstDeviceForConnection.element.classList.remove('connect-mode');
                this.firstDeviceForConnection = null;
            }
        }
        
        if (excludeMode !== 'test' && this.testMode) {
            this.testMode = false;
            if (this.buttons.testRoute) this.buttons.testRoute.classList.remove('primary');
            if (this.firstTestDevice) {
                this.firstTestDevice.element.classList.remove('test-mode');
                this.firstTestDevice = null;
            }
        }
        
        if (excludeMode !== 'dns' && this.manualDNSMode) {
            this.manualDNSMode = false;
            if (this.buttons.manualDNS) this.buttons.manualDNS.classList.remove('primary');
            if (this.dnsSourceDevice) {
                this.dnsSourceDevice.element.classList.remove('dns-source-mode');
                this.dnsSourceDevice = null;
            }
        }
    }
    
    // Ενημέρωση simulation button
    updateSimulationButton() {
        if (this.buttons.simulate && this.simulationManager) {
            if (this.simulationManager.isSimulating) {
                this.buttons.simulate.innerHTML = '<i class="fas fa-stop"></i> Διακοπή';
                this.buttons.simulate.classList.add('danger');
                this.buttons.simulate.classList.remove('success');
            } else {
                this.buttons.simulate.innerHTML = '<i class="fas fa-play"></i> Έναρξη';
                this.buttons.simulate.classList.add('success');
                this.buttons.simulate.classList.remove('danger');
            }
        }
    }
    
    // Ενημέρωση στατιστικών δικτύου
    updateNetworkStats() {
        setTimeout(() => {
            try {
                const deviceCount = document.getElementById('deviceCount');
                const connectionCount = document.getElementById('connectionCount');
                const packetCount = document.getElementById('packetCount');
                
                if (deviceCount && this.deviceManager) {
                    deviceCount.textContent = this.deviceManager.devices.length;
                }
                
                if (connectionCount && this.connectionManager) {
                    connectionCount.textContent = this.connectionManager.connections.length;
                }
                
                if (packetCount && this.simulationManager) {
                    const packets = this.simulationManager.activePackets?.size || 0;
                    packetCount.textContent = packets;
                }
            } catch (error) {
                console.warn('[UI] Error updating network stats:', error);
            }
        }, 100);
    }
    
    // Ρύθμιση keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            
            switch(e.key.toLowerCase()) {
                case 'escape':
                    e.preventDefault();
                    this.cancelOtherModes();
                    this.closeDevicePanel();
                    break;
                    
                case 'a':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        const types = ['router', 'switch', 'computer', 'server', 'dns', 'cloud', 'printer'];
                        const randomType = types[Math.floor(Math.random() * types.length)];
                        const color = this.getColorForType(randomType);
                        this.addDeviceToWorkspace(randomType, color);
                    }
                    break;
                    
                case 'delete':
                case 'backspace':
                    if (this.deviceManager.selectedDevice) {
                        e.preventDefault();
                        if (confirm(`Διαγραφή ${this.deviceManager.selectedDevice.name};`)) {
                            this.removeDevice(this.deviceManager.selectedDevice);
                            this.closeDevicePanel();
                        }
                    }
                    break;
            }
        });
    }
    
    // Βοηθητική συνάρτηση για χρώμα τύπου
    getColorForType(type) {
        const colors = {
            'router': '#3498db',
            'switch': '#2ecc71',
            'computer': '#e74c3c',
            'server': '#9b59b6',
            'cloud': '#f39c12',
            'printer': '#34495e',
            'dns': '#9b59b6'
        };
        return colors[type] || '#3498db';
    }
    
    // Μέθοδος για να κάνουμε τις συναρτήσεις προσβάσιμες από άλλα αρχεία
    exposeFunctions() {
        window.handleDeviceClick = (device) => this.handleDeviceClick(device);
        window.updateDeviceInfo = (device) => this.updateDeviceInfo(device);
        window.updateConnections = () => {
            if (this.connectionManager) {
                this.connectionManager.updateAllConnections(this.deviceManager.devices);
            }
        };
        window.addLog = (message, type) => this.addLog(message, type);
        
        // Compact design specific
        window.showDevicePanel = (device) => {
            if (this.connectionMode || this.testMode || this.manualDNSMode) {
                return; // Μην ανοίξεις το panel σε ειδικά modes
            }
            this.showDevicePanel(device);
        };

        window.closeDevicePanel = () => this.closeDevicePanel();
    }
    
    // ==================== ΣΥΝΑΡΤΗΣΕΙΣ ΣΥΝΔΕΣΗΣ ΜΕ SIMULATOR ====================
    
    // Οι υπόλοιπες μέθοδοι παραμένουν ίδιες, απλά προσαρμόζοντας το UI
    testPingFromDevice(device) {
        if (typeof window.simulator !== 'undefined' && window.simulator.testPingFromDevice) {
            window.simulator.testPingFromDevice(device);
        } else {
            this.addLog('Το σύστημα δεν είναι έτοιμο ακόμα.', 'warning');
        }
    }
    
    testRouteFromDevice(device) {
        this.toggleTestMode();
        if (this.testMode) {
            this.handleTestModeClick(device);
        }
    }
    
    testAutoDNSFromDevice(device) {
        if (typeof window.simulator !== 'undefined') {
            window.simulator.testAutoDNSFromDevice(device);
        } else {
            this.addLog('Το σύστημα δεν είναι έτοιμο ακόμα.', 'warning');
        }
    }
    
    testManualDNSFromDevice(device) {
        this.toggleManualDNSMode();
        if (this.manualDNSMode) {
            this.handleManualDNSModeClick(device);
        }
    }
    
    testCommunicationBetween(device1, device2) {
        if (typeof window.simulator !== 'undefined') {
            window.simulator.testCommunicationBetween(device1, device2);
        } else {
            this.addLog('Το σύστημα δεν είναι έτοιμο ακόμα.', 'warning');
        }
    }
    
    testDNSQuery(fromDevice, dnsServerDevice, domain) {
        if (typeof window.simulator !== 'undefined') {
            return window.simulator.testDNSQuery(fromDevice, dnsServerDevice, domain);
        } else {
            this.addLog('Το σύστημα δεν είναι έτοιμο ακόμα.', 'warning');
            return null;
        }
    }
    
    // CRUD operations - FIXED VERSION
    updateRouterConfig(router) {
        // FIRST read the form values
        const wanIpInput = document.getElementById('routerWanIp');
        const lanIpInput = document.getElementById('routerLanIp');
        const subnetInput = document.getElementById('routerSubnet');
        
        console.log('[UI] Updating router config:', router.name);
        console.log('[UI] Form values:', {
            wanIp: wanIpInput?.value,
            lanIp: lanIpInput?.value,
            subnet: subnetInput?.value
        });
        
        // Use the DeviceManager's update method for validation
        const configData = {
            wanIp: wanIpInput?.value?.trim() || router.interfaces.wan.ip,
            wanSubnet: subnetInput?.value?.trim() || router.interfaces.wan.subnetMask,
            lanIp: lanIpInput?.value?.trim() || router.interfaces.lan.ip,
            lanSubnet: subnetInput?.value?.trim() || router.interfaces.lan.subnetMask
        };
        
        try {
            // Use DeviceManager's update method which includes validation
            const result = this.deviceManager.updateRouterConfig(router, configData);
            
            if (result.success) {
                // Update visual display
                const ipElement = router.element?.querySelector('.device-ip');
                if (ipElement) {
                    const wanIP = router.interfaces.wan.ip || 'N/A';
                    const lanIP = router.interfaces.lan.ip || 'N/A';
                    ipElement.innerHTML = `WAN: ${wanIP}<br>LAN: ${lanIP}`;
                }
                
                this.addLog(`Ενημερώθηκε ο router: ${router.name}`, 'success');
                this.updateDeviceInfo(router);
            }
            
            return result;
        } catch (error) {
            this.addLog(`Σφάλμα: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }
    
    updateDNSConfig(dnsDevice) {
        // Read form values
        const ipInput = document.getElementById('dnsIp');
        const gatewayInput = document.getElementById('dnsGateway');
        
        console.log('[UI] Updating DNS config:', dnsDevice.name);
        
        const configData = {
            ip: ipInput?.value?.trim() || dnsDevice.ip,
            subnet: dnsDevice.subnetMask, // Use existing subnet
            gateway: gatewayInput?.value?.trim() || dnsDevice.gateway,
            dns: dnsDevice.dns?.[0] || dnsDevice.ip
        };
        
        try {
            // Use DeviceManager's update method for validation
            const result = this.deviceManager.updateStandardDeviceConfig(dnsDevice, configData);
            
            if (result.success) {
                // Update visual display
                const ipElement = dnsDevice.element?.querySelector('.device-ip');
                if (ipElement && dnsDevice.ip) {
                    ipElement.textContent = dnsDevice.ip;
                }
                
                this.addLog(`Ενημερώθηκε ο DNS server: ${dnsDevice.name}`, 'success');
                this.updateDeviceInfo(dnsDevice);
            }
            
            return result;
        } catch (error) {
            this.addLog(`Σφάλμα: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }
    
    updateDeviceConfig(device) {
        // Read form values
        const ipInput = document.getElementById('deviceIp');
        const subnetInput = document.getElementById('deviceSubnet');
        const gatewayInput = document.getElementById('deviceGateway');
        const dnsInput = document.getElementById('deviceDns');
        const domainInput = document.getElementById('deviceDomain');
        
        console.log('[UI] Updating device config:', device.name);
        
        const configData = {
            ip: ipInput?.value?.trim() || device.ip,
            subnet: subnetInput?.value?.trim() || device.subnetMask,
            gateway: gatewayInput?.value?.trim() || device.gateway,
            dns: dnsInput?.value?.trim() || device.dns?.[0],
            domainName: domainInput?.value?.trim() || device.domainName
        };
        
        try {
            // Use DeviceManager's update method based on device type
            let result;
            if (device.type === 'router') {
                result = this.deviceManager.updateRouterConfig(device, configData);
            } else if (device.type === 'dns') {
                result = this.deviceManager.updateStandardDeviceConfig(device, configData);
            } else if (device.type === 'switch') {
                result = this.deviceManager.updateStandardDeviceConfig(device, configData);
            } else {
                result = this.deviceManager.updateStandardDeviceConfig(device, configData);
            }
            
            if (result.success) {
                // Update visual display
                const ipElement = device.element?.querySelector('.device-ip');
                if (ipElement && device.ip) {
                    ipElement.textContent = device.ip;
                }
                
                this.addLog(`Ενημερώθηκε η συσκευή: ${device.name}`, 'success');
                this.updateDeviceInfo(device);
            }
            
            return result;
        } catch (error) {
            this.addLog(`Σφάλμα: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }
    
// In ui.js - FIXED VERSION:
addDNSRecordFromUI(dnsDevice) {
    try {
        const domainInput = document.getElementById('newDnsDomain');
        const ipInput = document.getElementById('newDnsIp');
        
        if (!domainInput || !ipInput) {
            this.addLog('Σφάλμα: Τα πεδία DNS δεν βρέθηκαν', 'error');
            return null;
        }
        
        const domain = domainInput.value.trim();
        const ip = ipInput.value.trim();
        
        if (!domain || !ip) {
            this.addLog('Παρακαλώ συμπληρώστε και τα δύο πεδία', 'error');
            return null;
        }
        
        // Validate IP before adding
        if (!this.deviceManager.simpleIPCheck(ip)) {
            this.addLog(`Λάθος IP: ${ip} - Κάθε αριθμός πρέπει να είναι 0-255 (π.χ. 192.168.1.100)`, 'error');
            return null;
        }
        
        // Call dnsManager.addDNSRecord directly (not addDNSRecordFromUI)
        const result = this.dnsManager.addDNSRecord(domain, ip, dnsDevice);
        
        if (result) {
            domainInput.value = '';
            ipInput.value = '';
            this.addLog(`Προστέθηκε DNS record: ${domain} → ${ip}`, 'success');
            setTimeout(() => this.updateDeviceInfo(dnsDevice), 100);
        }
        return result;
    } catch (error) {
        console.error('[UI] Error in addDNSRecordFromUI:', error);
        this.addLog(`Σφάλμα: ${error.message}`, 'error');
        return null;
    }
}
    
    removeDNSRecord(dnsDevice, domain) {
        if (confirm(`Διαγραφή DNS record για ${domain};`)) {
            if (typeof window.simulator !== 'undefined' && window.simulator.removeDNSRecord) {
                const result = window.simulator.removeDNSRecord(dnsDevice, domain);
                if (result) {
                    this.addLog(`Διαγράφηκε DNS record: ${domain}`, 'info');
                    this.updateDeviceInfo(dnsDevice);
                }
                return result;
            }
        }
        return false;
    }
    
    removeConnectionById(connId) {
        if (typeof window.simulator !== 'undefined' && window.simulator.removeConnectionById) {
            const result = window.simulator.removeConnectionById(connId);
            if (result) {
                this.addLog('Διαγράφηκε σύνδεση', 'info');
                this.updateNetworkStats();
            }
            return result;
        }
        return null;
    }
    
    removeDevice(device) {
        if (typeof window.simulator !== 'undefined' && window.simulator.removeDevice) {
            const result = window.simulator.removeDevice(device);
            if (result) {
                this.addLog(`Αφαιρέθηκε συσκευή: ${device.name}`, 'info');
                this.updateNetworkStats();
            }
            return result;
        }
        return null;
    }
    
    // Global functions
    testPingBetweenDevices() {
        if (typeof window.simulator !== 'undefined') {
            window.simulator.testPingBetweenDevices();
        } else {
            this.addLog('Το σύστημα δεν είναι έτοιμο ακόμα.', 'warning');
        }
    }
    
    testAutoDNS() {
        if (typeof window.simulator !== 'undefined') {
            window.simulator.testAutoDNS();
        } else {
            this.addLog('Το σύστημα δεν είναι έτοιμο ακόμα.', 'warning');
        }
    }
    
    toggleSimulation() {
        if (typeof window.simulator !== 'undefined') {
            window.simulator.toggleSimulation();
            this.updateSimulationButton();
        } else {
            this.addLog('Το σύστημα δεν είναι έτοιμο ακόμα.', 'warning');
        }
    }
    
    clearWorkspace() {
        if (confirm('Θέλετε να καθαρίσετε όλο το workspace; Όλες οι συσκευές και συνδέσεις θα διαγραφούν.')) {
            if (typeof window.simulator !== 'undefined') {
                window.simulator.clearWorkspace();
                this.closeDevicePanel();
                this.updateNetworkStats();
            } else {
                this.addLog('Το σύστημα δεν είναι έτοιμο ακόμα.', 'warning');
            }
        }
    }
    
    createPredefinedLan() {
        if (typeof window.simulator !== 'undefined') {
            window.simulator.createPredefinedLan();
            this.updateNetworkStats();
        } else {
            this.addLog('Το σύστημα δεν είναι έτοιμο ακόμα.', 'warning');
        }
    }
    
    createPredefinedWan() {
        if (typeof window.simulator !== 'undefined') {
            window.simulator.createPredefinedWan();
            this.updateNetworkStats();
        } else {
            this.addLog('Το σύστημα δεν είναι έτοιμο ακόμα.', 'warning');
        }
    }
    
    debugInfo() {
        if (typeof window.simulator !== 'undefined') {
            window.simulator.debugInfo();
        } else {
            this.addLog('Το σύστημα δεν είναι έτοιμο ακόμα.', 'warning');
        }
    }
    
    autoConfigureRouting() {
        if (typeof window.simulator !== 'undefined') {
            window.simulator.autoConfigureRouting();
        } else {
            this.addLog('Το σύστημα δεν είναι έτοιμο ακόμα.', 'warning');
        }
    }
}

// Εξαγωγή της κλάσης
export default UIManager;
