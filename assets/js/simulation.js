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
// Διαχείριση προσομοίωσης - ΔΙΟΡΘΩΜΕΝΗ ΈΚΔΟΣΗ με INTERNET ACCESS
class SimulationManager {
    constructor(connectionManager) {
        this.connectionManager = connectionManager;
        this.isSimulating = false;
        this.packetInterval = null;
        this.activePackets = new Set();
    }
    
    // Έναρξη προσομοίωσης
    startSimulation() {
        if (this.isSimulating) {
            console.log("[ΠΡΟΣΟΜΟΙΩΣΗ] Η προσομοίωση είναι ήδη ενεργή");
            return;
        }
        
        console.log("[ΠΡΟΣΟΜΟΙΩΣΗ] Έναρξη προσομοίωσης κυκλοφορίας...");
        
        // Έλεγχος για συνδέσεις
        if (this.connectionManager.connections.length === 0) {
            console.log("[ΠΡΟΣΟΜΟΙΩΣΗ] Δεν υπάρχουν συνδέσεις");
            this.addLog('Δεν υπάρχουν συνδέσεις για προσομοίωση', 'warning');
            return;
        }
        
        this.isSimulating = true;
        
        // Καθαρισμός υπάρχοντων πακέτων
        this.stopAllPackets();
        
        // Δημιουργία του πρώτου πακέτου αμέσως
        setTimeout(() => this.generateRandomPacket(), 500);
        
        // Δημιουργία πακέτων σε τακτά διαστήματα
        this.packetInterval = setInterval(() => {
            this.generateRandomPacket();
        }, window.CONFIG.SIMULATION_INTERVAL);
        
        this.addLog('Ξεκίνησε η προσομοίωση κυκλοφορίας', 'success');
    }
    
    // Δημιουργία τυχαίου πακέτου
    generateRandomPacket() {
        const connections = this.connectionManager.connections;
        
        if (connections.length === 0) {
            console.log("[ΠΡΟΣΟΜΟΙΩΣΗ] Δεν υπάρχουν συνδέσεις");
            return;
        }
        
        // Επιλογή τυχαίας σύνδεσης
        const randomConn = connections[Math.floor(Math.random() * connections.length)];
        
        // Εύρεση των συσκευών της σύνδεσης
        const device1 = window.deviceManager.getDeviceById(randomConn.device1Id);
        const device2 = window.deviceManager.getDeviceById(randomConn.device2Id);
        
        if (!device1 || !device2) {
            console.log("[ΠΡΟΣΟΜΟΙΩΣΗ] Σφάλμα: Δεν βρέθηκαν συσκευές για τη σύνδεση");
            return;
        }
        
        // Τυχαία επιλογή κατεύθυνσης
        let fromDevice, toDevice;
        if (Math.random() > 0.5) {
            fromDevice = device1;
            toDevice = device2;
        } else {
            fromDevice = device2;
            toDevice = device1;
        }
        
        // Δημιουργία πακέτου ΜΟΝΟ αν οι συσκευές είναι συνδεδεμένες φυσικά
        if (this.connectionManager.areDevicesConnected(fromDevice, toDevice)) {
            this.createSimplePacket(fromDevice, toDevice);
            
            // 30% πιθανότητα για απάντηση
            if (Math.random() < 0.3) {
                setTimeout(() => {
                    this.createSimplePacket(toDevice, fromDevice);
                }, Math.random() * 500 + 200);
            }
        } else {
            console.log(`[ΠΡΟΣΟΜΟΙΩΣΗ] Οι συσκευές ${fromDevice.name} και ${toDevice.name} δεν είναι συνδεδεμένες`);
        }
    }
    
    // Δημιουργία απλού πακέτου (ευθεία γραμμή)
    createSimplePacket(fromDevice, toDevice) {
        if (!fromDevice || !toDevice || fromDevice.id === toDevice.id) {
            return;
        }
        
        const packetId = `packet-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
        
        // Χρώμα με βάση τον τύπο συσκευής
        let packetColor = '#e74c3c'; // Default
        switch(fromDevice.type) {
            case 'router': packetColor = '#3498db'; break;
            case 'switch': packetColor = '#2ecc71'; break;
            case 'cloud': packetColor = '#f39c12'; break;
            case 'dns': packetColor = '#9b59b6'; break;
            case 'server': packetColor = '#9b59b6'; break;
            case 'computer': packetColor = '#e74c3c'; break;
            case 'printer': packetColor = '#34495e'; break;
        }
        
        // Δημιουργία στοιχείου
        const packetEl = document.createElement('div');
        packetEl.className = 'packet-animated';
        packetEl.id = packetId;
        packetEl.style.backgroundColor = packetColor;
        packetEl.style.boxShadow = `0 0 8px ${packetColor}`;
        
        // Αρχική θέση (στο κέντρο της πηγής)
        const startX = fromDevice.x + 60;
        const startY = fromDevice.y + 60;
        const endX = toDevice.x + 60;
        const endY = toDevice.y + 60;
        
        packetEl.style.left = `${startX}px`;
        packetEl.style.top = `${startY}px`;
        
        document.getElementById('workspace').appendChild(packetEl);
        
        // Προσθήκη στη λίστα
        this.activePackets.add(packetId);
        
        // Κίνηση
        const startTime = Date.now();
        const duration = 1200 + Math.random() * 800;
        
        const animate = () => {
            if (!packetEl.parentNode) {
                this.activePackets.delete(packetId);
                return;
            }
            
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Easing για πιο φυσική κίνηση
            const easeProgress = this.easeInOutQuad(progress);
            
            const currentX = startX + (endX - startX) * easeProgress;
            const currentY = startY + (endY - startY) * easeProgress;
            
            packetEl.style.left = `${currentX}px`;
            packetEl.style.top = `${currentY}px`;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // Αφαίρεση μετά την ολοκλήρωση
                setTimeout(() => {
                    if (packetEl.parentNode) {
                        packetEl.remove();
                    }
                    this.activePackets.delete(packetId);
                }, 200);
            }
        };
        
        requestAnimationFrame(animate);
        
        // Προσθήκη στο log
        const commInfo = this.connectionManager.canDevicesCommunicateDirectly(fromDevice, toDevice);
        const viaText = commInfo.viaGateway ? ' (μέσω Gateway)' : '';
        this.addLog(`Πακέτο: ${fromDevice.name} → ${toDevice.name}${viaText}`, 'info');
    }
    
    // Easing function
    easeInOutQuad(t) {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }
    
    // Διακοπή προσομοίωσης
    stopSimulation() {
        if (!this.isSimulating) return;
        
        console.log("[ΠΡΟΣΟΜΟΙΩΣΗ] Διακοπή προσομοίωσης...");
        
        this.isSimulating = false;
        if (this.packetInterval) {
            clearInterval(this.packetInterval);
            this.packetInterval = null;
        }
        
        // Καθαρισμός πακέτων
        this.stopAllPackets();
        
        this.addLog('Διακόπηκε η προσομοίωση κυκλοφορίας.', 'info');
    }
    
    // Σταμάτημα όλων των πακέτων
    stopAllPackets() {
        document.querySelectorAll('.packet-animated').forEach(el => el.remove());
        this.activePackets.clear();
    }
    
    // Δημιουργία ping πακέτου
    createPingPacket(fromDevice, toDevice, path = null) {
        const packetId = `ping-${Date.now()}`;
        
        if (path && path.length > 2) {
            this.animatePathPacketWithPath(packetId, path, fromDevice, toDevice);
            return;
        } else {
            const startX = fromDevice.x + 60;
            const startY = fromDevice.y + 60;
            const endX = toDevice.x + 60;
            const endY = toDevice.y + 60;
            
            const packetEl = document.createElement('div');
            packetEl.className = 'packet';
            packetEl.id = packetId;
            packetEl.style.left = `${startX - 6}px`;
            packetEl.style.top = `${startY - 6}px`;
            packetEl.style.backgroundColor = '#2ecc71';
            packetEl.style.boxShadow = '0 0 5px #2ecc71';
            
            document.getElementById('workspace').appendChild(packetEl);
            
            const packet = {
                id: packetId,
                fromDeviceId: fromDevice.id,
                toDeviceId: toDevice.id,
                element: packetEl,
                startTime: Date.now(),
                duration: 1000
            };
            
            this.connectionManager.packets.push(packet);
            this.animatePingPacket(packet, startX, startY, endX, endY);
        }
    }
    
    // Κίνηση ping πακέτου
    animatePingPacket(packet, startX, startY, endX, endY) {
        const startTime = packet.startTime;
        const duration = packet.duration;
        
        const updatePosition = () => {
            if (!packet.element || !packet.element.parentNode) return;
            
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            const currentX = startX + (endX - startX) * progress;
            const currentY = startY + (endY - startY) * progress;
            
            packet.element.style.left = `${currentX - 6}px`;
            packet.element.style.top = `${currentY - 6}px`;
            
            if (progress < 1) {
                requestAnimationFrame(updatePosition);
            } else {
                setTimeout(() => {
                    if (packet.element && packet.element.parentNode) {
                        packet.element.remove();
                        const index = this.connectionManager.packets.indexOf(packet);
                        if (index !== -1) {
                            this.connectionManager.packets.splice(index, 1);
                        }
                    }
                }, 200);
            }
        };
        
        requestAnimationFrame(updatePosition);
    }
    
    // Οπτικοποίηση διαδρομής
    visualizePath(path, fromDevice, toDevice) {
        document.querySelectorAll('.path-visual').forEach(el => el.remove());
        
        for (let i = 0; i < path.length - 1; i++) {
            const currentDevice = path[i];
            const nextDevice = path[i + 1];
            
            const x1 = currentDevice.x + 60;
            const y1 = currentDevice.y + 60;
            const x2 = nextDevice.x + 60;
            const y2 = nextDevice.y + 60;
            
            const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            
            const pathSegment = document.createElement('div');
            pathSegment.className = 'path-visual';
            pathSegment.style.cssText = `
                position: absolute;
                height: 8px;
                background-color: #9b59b6;
                opacity: 0.7;
                width: ${length}px;
                left: ${x1}px;
                top: ${y1}px;
                transform: rotate(${angle}deg);
                transform-origin: 0 0;
                z-index: 3;
                pointer-events: none;
                border-radius: 4px;
            `;
            
            document.getElementById('workspace').appendChild(pathSegment);
        }
        
        this.animatePathPacketWithPath(`path-trace-${Date.now()}`, path, fromDevice, toDevice);
        
        setTimeout(() => {
            document.querySelectorAll('.path-visual').forEach(el => el.remove());
        }, window.CONFIG.PATH_ANIMATION_DURATION);
    }
    
    // Κίνηση πακέτου σε διαδρομή
    animatePathPacketWithPath(packetId, path, fromDevice, toDevice) {
        if (path.length < 2) return;
        
        const packetEl = document.createElement('div');
        packetEl.className = 'packet-trace';
        packetEl.id = packetId;
        
        document.getElementById('workspace').appendChild(packetEl);
        
        this.animatePathSegment(packetEl, path, 0);
    }
    
    // Κίνηση πακέτου σε τμήμα διαδρομής
    animatePathSegment(packetEl, path, segmentIndex) {
        if (segmentIndex >= path.length - 1) {
            setTimeout(() => {
                if (packetEl && packetEl.parentNode) {
                    packetEl.remove();
                }
            }, 500);
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
                    this.animatePathSegment(packetEl, path, segmentIndex + 1);
                }, 100);
            }
        };
        
        requestAnimationFrame(animate);
    }
    
    // Τoggle προσομοίωσης
    toggleSimulation() {
        try {
            if (this.isSimulating) {
                this.stopSimulation();
                return false;
            } else {
                this.startSimulation();
                return true;
            }
        } catch (error) {
            this.addLog(`Σφάλμα: ${error.message}`, 'error');
            throw error;
        }
    }
    
    // Έλεγχος αν IP είναι εξωτερική (Internet)
    isExternalIP(ip) {
        if (!ip || ip === 'N/A') return false;
        
        const privateRanges = [
            /^10\./, /^172\.(1[6-9]|2[0-9]|3[0-1])\./, /^192\.168\./,
            /^127\./, /^169\.254\./, /^203\.0\.113\./
        ];
        
        return !privateRanges.some(regex => regex.test(ip));
    }
    
    // Δοκιμή ping από συγκεκριμένη συσκευή
    testPingFromDeviceWithPrompt(fromDevice, deviceManager) {
        return new Promise((resolve) => {
            const devices = deviceManager.devices;
            
            // Φίλτρο συσκευών με έγκυρη IP (εκτός από τον εαυτό του)
            const availableDevices = devices.filter(d => 
                d.id !== fromDevice.id && 
                d.ip && d.ip !== 'N/A' && d.ip !== '0.0.0.0' && d.ip !== undefined
            );
            
            if (availableDevices.length === 0) {
                alert('Δεν υπάρχουν άλλες συσκευές με έγκυρη IP για ping');
                this.addLog('Δεν υπάρχουν άλλες συσκευές με έγκυρη IP', 'warning');
                resolve({ success: false });
                return;
            }
            
            // Δημιουργία μηνύματος prompt
            let message = `Ping από ${fromDevice.name} (${fromDevice.ip})\n\n`;
            message += 'Διαθέσιμες συσκευές:\n';
            
            availableDevices.forEach((device, index) => {
                const gatewayInfo = device.gateway && device.gateway !== '0.0.0.0' ? 
                    ` [GW: ${device.gateway}]` : '';
                message += `${index + 1}. ${device.name} - ${device.ip}${gatewayInfo}\n`;
            });
            
            message += '\nΕισάγετε:\n';
            message += '- Αριθμό για επιλογή συσκευής (π.χ. 1)\n';
            message += '- IP διεύθυνση (π.χ. 192.168.1.1)\n';
            
            const userInput = prompt(message);
            
            if (!userInput) {
                this.addLog('Ακυρώθηκε η δοκιμή ping', 'info');
                resolve(null);
                return;
            }
            
            // Επεξεργασία εισόδου
            const input = userInput.trim();
            
            // Έλεγχος για αριθμό
            let selectedIndex = null;
            
            // ΜΟΝΟ αν το input είναι αποκλειστικά ψηφία
            if (/^\d+$/.test(input)) {
                const num = parseInt(input, 10);
                if (num >= 1 && num <= availableDevices.length) {
                    selectedIndex = num - 1;
                }
            }
            
            if (selectedIndex !== null) {
                // Επιλογή συσκευής από τη λίστα
                const targetDevice = availableDevices[selectedIndex];
                this.addLog(`Επιλέχθηκε: ${targetDevice.name} (${targetDevice.ip})`, 'info');
                const result = this.testPing(fromDevice, targetDevice);
                resolve(result);
            } else {
                // Έλεγχος αν είναι IP διεύθυνση
                if (window.isValidIP && window.isValidIP(input)) {
                    // Ψάξε συσκευή με αυτή την IP
                    const targetDevice = deviceManager.getDeviceByIP(input);
                    if (targetDevice) {
                        // Βρέθηκε συσκευή - κάνε ping
                        const result = this.testPing(fromDevice, targetDevice);
                        resolve(result);
                    } else {
                        // ΔΕΝ βρέθηκε συσκευή με αυτή την IP
                        this.addLog(`PING ${fromDevice.name} → ${input} - ΑΠΟΤΥΧΙΑ (Δεν βρέθηκε συσκευή με αυτή την IP)`, 'error');
                        
                        // Αναζήτηση διαδρομής (ακόμα και αν δεν υπάρχει συσκευή)
                        const commInfo = this.connectionManager.canDevicesCommunicateWithPath(
                            fromDevice, 
                            { ip: input, type: 'external', name: `Εξωτερικό ${input}` }
                        );
                        
                        if (commInfo.canCommunicate && commInfo.path) {
                            // Μπορεί να φτάσει (π.χ. μέσω gateway) αλλά δεν υπάρχει συσκευή
                            this.addLog(`Η συσκευή ${fromDevice.name} μπορεί να φτάσει στην IP ${input} (δεν υπάρχει συσκευή)`, 'warning');
                            this.visualizePath(commInfo.path, fromDevice, { name: `Εξωτερικό ${input}`, x: 100, y: 100 });
                            resolve({ success: true, viaGateway: commInfo.viaGateway, external: true });
                        } else {
                            // Δεν μπορεί να φτάσει
                            this.addLog(`Η συσκευή ${fromDevice.name} ΔΕΝ μπορεί να φτάσει στην IP ${input}`, 'error');
                            resolve({ success: false, external: true });
                        }
                    }
                } else {
                    alert(`Μη έγκυρη είσοδος: "${input}"\n\nΕισάγετε:\n1. Αριθμό από 1 έως ${availableDevices.length} (για συσκευή)\n2. Έγκυρη IP διεύθυνση (π.χ. 192.168.1.1)`);
                    this.addLog(`Μη έγκυρη είσοδος: ${input}`, 'error');
                    resolve({ success: false, error: 'Invalid input' });
                }
            }
        });
    }
    
testPing(fromDevice, toDevice) {
    console.log(`[PING] Έλεγχος: ${fromDevice.name} → ${toDevice.name}`);

    const fromIP = this.getIPForLog(fromDevice);
    const toIP = this.getIPForLog(toDevice);

    console.log(`[PING] Από IP: ${fromIP}, Προς IP: ${toIP}`);

    // Helper για IP/Subnet
    const ipToInt = ip => ip.split('.').reduce((acc, val) => (acc << 8) + (+val), 0);
    const inSameSubnet = (ip1, mask1, ip2, mask2) => {
        if (!ip1 || !mask1 || !ip2 || !mask2) return false;
        return (ipToInt(ip1) & ipToInt(mask1)) === (ipToInt(ip2) & ipToInt(mask2));
    };

    // Check αν απαιτείται gateway (διαφορετικό subnet)
    let requiresGateway = false;
    if (
        fromDevice.gateway &&
        fromDevice.gateway !== '0.0.0.0' &&
        fromDevice.gateway !== 'N/A' &&
        (!inSameSubnet(fromDevice.ip, fromDevice.subnetMask, toDevice.ip, toDevice.subnetMask || fromDevice.subnetMask))
    ) {
        requiresGateway = true;
    }

    let finalPath = null;
    if (requiresGateway) {
        // Gateway device
        const fromGatewayIP = fromDevice.gateway ||
            (fromDevice.interfaces?.lan?.gateway) ||
            (fromDevice.interfaces?.wan?.gateway);

        console.log(`[PING] Gateway συσκευής: ${fromGatewayIP}`);

        const gatewayDevice = window.deviceManager.getDeviceByIP(fromGatewayIP);

        if (gatewayDevice && gatewayDevice.type === 'router') {
            console.log(`[PING] Το gateway είναι router: ${gatewayDevice.name}`);

            // Path από απόDevice προς gateway
            const pathToGateway = this.connectionManager.findPathBetweenDevices(fromDevice, gatewayDevice);
            // Path από gateway προς ύψος
            const pathFromGateway = this.connectionManager.findPathBetweenDevices(gatewayDevice, toDevice);

            if (
                pathToGateway &&
                pathFromGateway &&
                pathToGateway.length > 0 &&
                pathFromGateway.length > 0
            ) {
                // Ενοποίηση διαδρομής (χωρίς διπλότυπο gateway)
                if (pathToGateway[pathToGateway.length - 1].id === pathFromGateway[0].id) {
                    finalPath = [...pathToGateway, ...pathFromGateway.slice(1)];
                } else {
                    finalPath = [...pathToGateway, ...pathFromGateway];
                }

                this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) ΜΕΣΩ GATEWAY (${gatewayDevice.name}) - ΕΠΙΤΥΧΙΑ`, 'success');
                this.addLog(`Διαδρομή: ${finalPath.map(d => d.name).join(' → ')}`, 'info');
                console.log(`[PING] Πλήρης διαδρομή (μέσω gateway):`, finalPath.map(d => d.name).join(' → '));
                this.visualizePath(finalPath, fromDevice, toDevice);
                this.createPingPacket(fromDevice, toDevice, finalPath);
                return { success: true, viaGateway: true, path: finalPath };
            } else {
                console.log(`[PING] Δεν βρέθηκε πλήρης διαδρομή μέσω gateway`);
                this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) - ΑΠΟΤΥΧΙΑ (δεν υπάρχει διαδρομή μέσω gateway)`, 'error');
                return { success: false, viaGateway: true };
            }
        } else {
            console.log(`[PING] Το gateway ${fromGatewayIP} δεν είναι router ή δεν βρέθηκε`);
            this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) - ΑΠΟΤΥΧΙΑ (δεν βρέθηκε router gateway)`, 'error');
            return { success: false, viaGateway: true };
        }
    } else {
        // ΠΕΡΙΠΤΩΣΗ ΧΩΡΙΣ GATEWAY (same subnet)
        const communication = this.connectionManager.canDevicesCommunicateWithPath(fromDevice, toDevice);

        if (communication.canCommunicate) {
            if (communication.viaGateway) {
                this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) ΜΕΣΩ GATEWAY - ΕΠΙΤΥΧΙΑ`, 'success');
            } else {
                this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) - ΕΠΙΤΥΧΙΑ`, 'success');
            }

            if (communication.path) {
                this.visualizePath(communication.path, fromDevice, toDevice);
                this.addLog(`Διαδρομή: ${communication.path.map(d => d.name).join(' → ')}`, 'info');
                console.log(`[PING] Πλήρης διαδρομή: ${communication.path.map(d => d.name).join(' → ')}`);
            }

            this.createPingPacket(fromDevice, toDevice, communication.path);
            return { success: true, viaGateway: communication.viaGateway, path: communication.path };
        } else {
            console.log(`[PING] Αποτυχία επικοινωνίας: δεν υπάρχει διαδρομή`);
            this.addLog(`PING ${fromDevice.name} (${fromIP}) → ${toDevice.name} (${toIP}) - ΑΠΟΤΥΧΙΑ`, 'error');
            return { success: false };
        }
    }
}
    // Βοηθητική συνάρτηση για IP στο log
    getIPForLog(device) {
        if (!device) return 'N/A';
        
        if (device.type === 'router') {
            // Για router: LAN IP αν υπάρχει, αλλιώς WAN IP, αλλιώς N/A
            return device.interfaces?.lan?.ip || device.interfaces?.wan?.ip || 'N/A';
        }
        
        // Για άλλες συσκευές: απλό IP
        return device.ip || 'N/A';
    }
    
    // Δοκιμή ping μεταξύ τυχαίων συσκευών
    testPingBetweenDevices(deviceManager) {
        const devices = deviceManager.devices;
        if (devices.length < 2) {
            throw new Error('Πρέπει να υπάρχουν τουλάχιστον 2 συσκευές για δοκιμή ping');
        }
        
        const device1 = devices[Math.floor(Math.random() * devices.length)];
        let device2;
        do {
            device2 = devices[Math.floor(Math.random() * devices.length)];
        } while (device2.id === device1.id);
        
        return this.testPing(device1, device2);
    }
    
    // Δοκιμή επικοινωνίας μεταξύ δύο συσκευών
    testCommunicationBetween(device1, device2) {
        const communication = this.connectionManager.canDevicesCommunicateWithPath(device1, device2);
        
        if (communication.canCommunicate) {
            const viaText = communication.viaGateway ? 'ΜΕΣΩ GATEWAY/ROUTING' : 'ΑΜΕΣΑ';
            this.addLog(`ΔΟΚΙΜΗ: ${device1.name} → ${device2.name} - ΕΠΙΤΥΧΙΑ ${viaText}`, 'success');
            
            if (communication.path) {
                this.addLog(`Διαδρομή: ${communication.path.map(d => d.name).join(' → ')}`, 'info');
                this.visualizePath(communication.path, device1, device2);
            }
            return { success: true, viaGateway: communication.viaGateway, path: communication.path };
        } else {
            this.addLog(`ΔΟΚΙΜΗ: ${device1.name} → ${device2.name} - ΑΠΟΤΥΧΙΑ`, 'error');
            return { success: false };
        }
    }
    
    // Βοηθητική συνάρτηση για logging
    addLog(message, type = 'info') {
        if (typeof window.addLog === 'function') {
            window.addLog(message, type);
        } else {
            console.log(`[ΠΡΟΣΟΜΟΙΩΣΗ ${type.toUpperCase()}] ${message}`);
        }
    }
}

// Εξαγωγή της κλάσης
export default SimulationManager;
