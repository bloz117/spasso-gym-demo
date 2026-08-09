document.addEventListener('DOMContentLoaded', function() {
    // Variables globales
    let currentUser = null;
    const adminCredentials = {
        email: 'admin@spasso.cl',
        password: 'admin123'
    };
    
    // Credenciales de recepcionistas
    const receptionCredentials = [
        {
            email: 'recepcion1@spasso.cl',
            password: 'recepcion1',
            name: 'Recepcionista Mañana',
            shift: 'morning'
        },
        {
            email: 'recepcion2@spasso.cl',
            password: 'recepcion2',
            name: 'Recepcionista Tarde',
            shift: 'afternoon'
        }
    ];
    
    // Datos de ejemplo para usuarios
    const sampleUsers = [
        // Dueño
        {
            name: 'Dueño Spasso',
            email: 'dueno@spasso.cl',
            phone: '73415902',
            password: 'admin123',
            role: 'owner',
            status: 'active'
        },
        // Recepcionista mañana
        {
            name: 'Recepcionista Mañana',
            email: 'recepcion1@spasso.cl',
            phone: '73415902',
            password: 'recepcion1',
            role: 'reception',
            status: 'active',
            shift: 'morning'
        },
        // Recepcionista tarde
        {
            name: 'Recepcionista Tarde',
            email: 'recepcion2@spasso.cl',
            phone: '73415902',
            password: 'recepcion2',
            role: 'reception',
            status: 'active',
            shift: 'afternoon'
        },
        // Usuario normal
        {
            name: 'Juan Pérez',
            email: 'juan@email.com',
            phone: '+56 9 8765 4321',
            password: 'juan123',
            role: 'user',
            status: 'active',
            membership: {
                plan: 'Premium',
                startDate: '2023-06-01',
                endDate: '2023-06-30'
            }
        }
    ];
    
    // Elementos del DOM
    const loginBtn = document.getElementById('loginBtn');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');
    const profileModal = document.getElementById('profileModal');
    const adminModal = document.getElementById('adminModal');
    const receptionModal = document.getElementById('receptionModal');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const closeModals = document.querySelectorAll('.close-modal');
    const editContentBtn = document.getElementById('editContentBtn');
    const saveChangesBtn = document.getElementById('saveChangesBtn');
    const manageUsersBtn = document.getElementById('manageUsersBtn');
    const manageMembershipsBtn = document.getElementById('manageMembershipsBtn');
    const adminControls = document.getElementById('adminControls');
    const receptionControls = document.getElementById('receptionControls');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const levelBtns = document.querySelectorAll('.level-btn');
    const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
    const adminLoginCheckbox = document.getElementById('adminLogin');
    const receptionLoginCheckbox = document.getElementById('receptionLogin');
    const userSearch = document.getElementById('userSearch');
    const searchUserBtn = document.getElementById('searchUserBtn');
    const usersList = document.getElementById('usersList');
    const notification = document.getElementById('notification');
    const membershipsList = document.getElementById('membershipsList');
    const membershipSearch = document.getElementById('membershipSearch');
    const searchMembershipBtn = document.getElementById('searchMembershipBtn');
    const whatsappPopup = document.getElementById('whatsappPopup');
    const whatsappMessage = document.getElementById('whatsappMessage');
    const whatsappLink = document.getElementById('whatsappLink');
    const closeWhatsapp = document.getElementById('closeWhatsapp');
    const registerGymIncomeBtn = document.getElementById('registerGymIncomeBtn');
    const registerSaunaIncomeBtn = document.getElementById('registerSaunaIncomeBtn');
    const registerPoolIncomeBtn = document.getElementById('registerPoolIncomeBtn');
    const viewTodayClientsBtn = document.getElementById('viewTodayClientsBtn');
    const receptionShiftSelect = document.getElementById('receptionShiftSelect');
    const receptionistName = document.getElementById('receptionistName');
    const shiftSelect = document.getElementById('shiftSelect');
    const receptionistNameInput = document.getElementById('receptionistNameInput');
    const registerIncomeBtn = document.getElementById('registerIncomeBtn');
    const viewClientsBtn = document.getElementById('viewClientsBtn');

    // reproduccion automatica de musica
document.getElementById('audio').play();

    // Imágenes para el carrusel del inicio
    const heroImages = [
        'img/carrusel1.png',
        'img/carrusel2.jpeg',
        'img/carrusel3.jpg',
        'img/carrusel4.jpg'
    ];
    
    // Crear partículas
    function createParticles() {
        const particlesContainer = document.getElementById('particles');
        const particleCount = 30;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');
            
            // Tamaño aleatorio entre 2px y 6px
            const size = Math.random() * 4 + 2;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            
            // Posición aleatoria
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            
            // Color aleatorio entre los colores corporativos
            const colors = ['#FF00FF', '#00BFFF', '#D2B48C'];
            particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            
            // Duración de animación aleatoria
            const duration = Math.random() * 10 + 5;
            particle.style.animationDuration = `${duration}s`;
            
            // Retraso de animación aleatorio
            particle.style.animationDelay = `${Math.random() * 5}s`;
            
            particlesContainer.appendChild(particle);
        }
    }
    
    // Iniciar carrusel de imágenes en el inicio
    function initHeroCarousel() {
        const heroSection = document.getElementById('inicio');
        let currentImage = 0;
        
        // Cambiar imagen cada 2.5segundos
        setInterval(() => {
            currentImage = (currentImage + 1) % heroImages.length;
            heroSection.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('${heroImages[currentImage]}')`;
        }, 2500);
    }
    
    // Mostrar notificación
    function showNotification(message, type = 'info') {
        notification.textContent = message;
        notification.className = `notification show ${type}`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }
    
    // Mostrar/ocultar modales
    function showModal(modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    function hideModal(modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    
    // Habilitar scroll horizontal en contenedores
    function enableHorizontalScroll() {
        const scrollableContainers = [
            document.getElementById('hombres-tab'), 
            document.getElementById('mujeres-tab'),
            document.getElementById('users-tab'),
            document.getElementById('memberships-tab'),
            document.querySelector('.routine-grid'),
            document.querySelector('.users-list')
        ];
        
        scrollableContainers.forEach(container => {
            if (container) {
                container.style.overflowX = 'auto';
                container.style.overflowY = 'hidden';
                container.style.whiteSpace = 'nowrap';
                container.style.paddingBottom = '15px';
                container.style.scrollBehavior = 'smooth';
                
                // Asegurar que los elementos hijos se muestren en línea
                Array.from(container.children).forEach(child => {
                    child.style.display = 'inline-block';
                    child.style.whiteSpace = 'normal';
                    child.style.verticalAlign = 'top';
                    child.style.marginRight = '15px';
                });
                
                // Configurar el evento de rueda del mouse
                container.addEventListener('wheel', function(e) {
                    // Prevenir el scroll vertical por defecto
                    e.preventDefault();
                    
                    // Ajustar la velocidad del scroll (puedes modificar este valor)
                    const scrollSpeed = 40;
                    
                    // Aplicar el scroll horizontal
                    this.scrollLeft += e.deltaY * scrollSpeed;
                });
            }
        });
    }
    
    // Cambiar entre pestañas de rutinas
    function switchTab(tabName) {
        document.querySelectorAll('.routine-content').forEach(content => {
            content.style.display = 'none';
        });
        const activeTab = document.getElementById(`${tabName}-tab`);
        activeTab.style.display = 'block';
        
        // Mostrar nivel por defecto (novato)
        switchLevel('novato', tabName);
        
        // Aplicar scroll horizontal después de cambiar de pestaña
        setTimeout(() => {
            enableHorizontalScroll();
        }, 50);
        
        tabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
    }
    
    // Cambiar entre niveles de rutina
    function switchLevel(level, tabName) {
        // Ocultar todas las rutinas del nivel actual
        document.querySelectorAll(`#${tabName}-tab .routine-grid`).forEach(grid => {
            grid.style.display = 'none';
        });
        
        // Mostrar las rutinas del nivel seleccionado
        document.getElementById(`${tabName}-${level}`).style.display = 'flex';
        
        // Actualizar botones de nivel
        levelBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.level === level) {
                btn.classList.add('active');
            }
        });
    }
    
    // Cambiar entre pestañas de administrador
    function switchAdminTab(tabName) {
        document.querySelectorAll('.admin-tab-content').forEach(content => {
            content.style.display = 'none';
        });
        const activeTab = document.getElementById(`${tabName}-tab`);
        activeTab.style.display = 'block';
        
        // Aplicar scroll horizontal después de cambiar de pestaña
        setTimeout(() => {
            enableHorizontalScroll();
        }, 50);
        
        adminTabBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.tab === tabName) {
                btn.classList.add('active');
            }
        });
        
        // Cargar contenido según la pestaña
        if (tabName === 'users') {
            loadUsers();
        } else if (tabName === 'memberships') {
            loadMemberships();
        }
    }
    
    // Iniciar sesión
    function loginUser(email, password, isAdminLogin = false, isReceptionLogin = false) {
        if (isAdminLogin) {
            // Verificar credenciales de admin
            if (email === adminCredentials.email && password === adminCredentials.password) {
                currentUser = {
                    name: 'Administrador Spasso',
                    email: adminCredentials.email,
                    role: 'admin',
                    phone: '+56 9 8765 4321',
                    status: 'active'
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showNotification('Bienvenido Administrador', 'success');
                return true;
            }
            showNotification('Credenciales de administrador incorrectas', 'error');
            return false;
        } else if (isReceptionLogin) {
            // Verificar credenciales de recepcionista
            const receptionist = receptionCredentials.find(
                r => r.email === email && r.password === password
            );
            
            if (receptionist) {
                currentUser = {
                    name: receptionist.name,
                    email: receptionist.email,
                    role: 'reception',
                    status: 'active',
                    shift: receptionist.shift
                };
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showNotification(`Bienvenido ${receptionist.name}`, 'success');
                return true;
            }
            showNotification('Credenciales de recepción incorrectas', 'error');
            return false;
        } else {
            // Verificar usuarios normales
            const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
            const user = users.find(u => u.email === email && u.password === password);
            
            if (user) {
                // Verificar si el usuario está bloqueado
                if (user.status === 'blocked') {
                    showNotification('Tu cuenta ha sido bloqueada. Contacta al administrador.', 'error');
                    return false;
                }
                
                currentUser = user;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                showNotification(`Bienvenido ${user.name.split(' ')[0]}`, 'success');
                
                return true;
            }
            
            showNotification('Correo o contraseña incorrectos', 'error');
            return false;
        }
    }
    
    // Registrar usuario
    function registerUser(userData) {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        
        // Validar campos
        if (!userData.name || !userData.email || !userData.password) {
            showNotification('Todos los campos son obligatorios', 'error');
            return false;
        }
        
        if (userData.password !== document.getElementById('registerConfirm').value) {
            showNotification('Las contraseñas no coinciden', 'error');
            return false;
        }
        
        // Verificar si el usuario ya existe
        if (users.some(u => u.email === userData.email)) {
            showNotification('El correo electrónico ya está registrado', 'error');
            return false;
        }
        
        // No permitir registro con email de admin o recepción
        if (userData.email === adminCredentials.email || 
            receptionCredentials.some(r => r.email === userData.email)) {
            showNotification('No puedes registrarte con este correo electrónico', 'error');
            return false;
        }
        
        // Validar formato de email
        if (!/^\S+@\S+\.\S+$/.test(userData.email)) {
            showNotification('Ingresa un correo electrónico válido', 'error');
            return false;
        }
        
        // Validar longitud de contraseña
        if (userData.password.length < 6) {
            showNotification('La contraseña debe tener al menos 6 caracteres', 'error');
            return false;
        }
        
        users.push({
            ...userData,
            role: 'user',
            status: 'active',
            membership: {
                plan: 'Ninguna',
                startDate: '',
                endDate: ''
            }
        });
        localStorage.setItem('spassoUsers', JSON.stringify(users));
        
        showNotification('¡Registro exitoso! Ahora puedes iniciar sesión', 'success');
        return true;
    }
    
    // Actualizar UI según el usuario
    function updateUI() {
        if (currentUser) {
            loginBtn.innerHTML = `<i class="fas fa-user"></i> ${currentUser.name.split(' ')[0]}`;
            
            // Mostrar datos en el perfil
            document.getElementById('profileName').textContent = currentUser.name;
            document.getElementById('profileEmail').textContent = currentUser.email;
            
            // Actualizar el rol mostrado
            const roleElement = document.getElementById('profileRole');
            if (currentUser.role === 'admin') {
                roleElement.textContent = 'Administrador';
                roleElement.style.color = 'var(--rosa-fucsia)';
                roleElement.style.fontWeight = 'bold';
                adminControls.style.display = 'block';
                receptionControls.style.display = 'none';
            } else if (currentUser.role === 'reception') {
                roleElement.textContent = 'Recepcionista';
                roleElement.style.color = 'var(--celeste)';
                roleElement.style.fontWeight = 'bold';
                adminControls.style.display = 'none';
                receptionControls.style.display = 'block';
                
                // Configurar turno y nombre del recepcionista
                if (currentUser.shift) {
                    shiftSelect.value = currentUser.shift;
                    receptionShiftSelect.value = currentUser.shift;
                }
                if (currentUser.name) {
                    receptionistNameInput.value = currentUser.name;
                    receptionistName.value = currentUser.name;
                }
            } else if (currentUser.role === 'owner') {
                roleElement.textContent = 'Dueño';
                roleElement.style.color = 'var(--cafe-claro)';
                roleElement.style.fontWeight = 'bold';
                adminControls.style.display = 'block';
                receptionControls.style.display = 'none';
            } else {
                roleElement.textContent = 'Miembro';
                roleElement.style.color = 'var(--celeste)';
                roleElement.style.fontWeight = 'normal';
                adminControls.style.display = 'none';
                receptionControls.style.display = 'none';
                
                // Mostrar información de membresía
                updateMembershipInfo();
            }
            
            // Habilitar menús de usuario
            document.body.classList.add('logged-in');
            
            // Habilitar scroll horizontal en los menús
            setTimeout(() => {
                enableHorizontalScroll();
            }, 100);
        } else {
            loginBtn.innerHTML = '<i class="fas fa-user"></i> Iniciar Sesión';
            document.body.classList.remove('logged-in');
        }
    }
    
    // Actualizar información de membresía en el perfil
    function updateMembershipInfo() {
        if (currentUser && currentUser.membership) {
            document.getElementById('membershipPlan').textContent = currentUser.membership.plan;
            
            if (currentUser.membership.startDate) {
                const startDate = new Date(currentUser.membership.startDate);
                document.getElementById('membershipStart').textContent = startDate.toLocaleDateString('es-CL');
            } else {
                document.getElementById('membershipStart').textContent = 'No asignada';
            }
            
            if (currentUser.membership.endDate) {
                const endDate = new Date(currentUser.membership.endDate);
                document.getElementById('membershipEnd').textContent = endDate.toLocaleDateString('es-CL');
            } else {
                document.getElementById('membershipEnd').textContent = 'No asignada';
            }
        }
    }
    
    // Habilitar edición de contenido
    function enableContentEditing() {
        const editableElements = document.querySelectorAll('h1, h2, h3, h4, p:not(.price):not(.toggle-form)');
        
        editableElements.forEach(el => {
            el.contentEditable = true;
            el.style.borderBottom = '1px dashed #ccc';
            el.style.paddingBottom = '2px';
        });
        
        editContentBtn.style.display = 'none';
        saveChangesBtn.style.display = 'inline-block';
        showNotification('Modo edición activado. Haz clic en cualquier texto para editarlo', 'info');
    }
    
    // Deshabilitar edición de contenido
    function disableContentEditing() {
        const editableElements = document.querySelectorAll('[contenteditable="true"]');
        
        editableElements.forEach(el => {
            el.contentEditable = false;
            el.style.borderBottom = 'none';
            el.style.paddingBottom = '0';
        });
        
        editContentBtn.style.display = 'inline-block';
        saveChangesBtn.style.display = 'none';
        showNotification('Cambios guardados correctamente', 'success');
    }
    
    // Cargar usuarios en el panel de administración
    function loadUsers(searchTerm = '') {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        usersList.innerHTML = '';
        
        // Filtrar usuarios si hay término de búsqueda
        const filteredUsers = searchTerm 
            ? users.filter(user => 
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                user.email.toLowerCase().includes(searchTerm.toLowerCase()))
            : users;
        
        if (filteredUsers.length === 0) {
            usersList.innerHTML = '<p>No se encontraron usuarios</p>';
            return;
        }
        
        filteredUsers.forEach(user => {
            const userCard = document.createElement('div');
            userCard.className = 'user-card';
            userCard.style.display = 'inline-block';
            userCard.style.width = '300px';
            userCard.style.marginRight = '15px';
            
            userCard.innerHTML = `
                <div class="user-info">
                    <i class="fas fa-user-circle"></i>
                    <div>
                        <h4>${user.name}</h4>
                        <p>${user.email}</p>
                        <span class="user-role ${user.role}">${user.role === 'admin' ? 'Admin' : user.role === 'owner' ? 'Dueño' : user.role === 'reception' ? 'Recepcionista' : 'Miembro'}</span>
                        <span class="user-status ${user.status}">${user.status === 'blocked' ? 'Bloqueado' : 'Activo'}</span>
                    </div>
                </div>
                <div class="user-actions">
                    ${user.role !== 'admin' && user.role !== 'owner' 
                        ? `<button class="make-admin" data-email="${user.email}">Hacer Admin</button>` 
                        : ''}
                    <button class="edit-user" data-email="${user.email}"><i class="fas fa-edit"></i></button>
                    <button class="block-user" data-email="${user.email}">${user.status === 'blocked' ? 'Desbloquear' : 'Bloquear'}</button>
                    <button class="delete-user" data-email="${user.email}"><i class="fas fa-trash"></i></button>
                </div>
            `;
            
            usersList.appendChild(userCard);
        });
        
        // Agregar event listeners a los botones
        document.querySelectorAll('.make-admin').forEach(btn => {
            btn.addEventListener('click', function() {
                makeAdmin(this.dataset.email);
            });
        });
        
        document.querySelectorAll('.edit-user').forEach(btn => {
            btn.addEventListener('click', function() {
                editUser(this.dataset.email);
            });
        });
        
        document.querySelectorAll('.block-user').forEach(btn => {
            btn.addEventListener('click', function() {
                toggleBlockUser(this.dataset.email);
            });
        });
        
        document.querySelectorAll('.delete-user').forEach(btn => {
            btn.addEventListener('click', function() {
                deleteUser(this.dataset.email);
            });
        });
        
        // Habilitar scroll horizontal después de cargar los usuarios
        setTimeout(() => {
            enableHorizontalScroll();
        }, 50);
    }
    
    // Convertir usuario en admin
    function makeAdmin(email) {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        const updatedUsers = users.map(user => {
            if (user.email === email) {
                return { ...user, role: 'admin' };
            }
            return user;
        });
        
        localStorage.setItem('spassoUsers', JSON.stringify(updatedUsers));
        loadUsers();
        showNotification('Usuario promovido a administrador', 'success');
    }
    
    // Bloquear/Desbloquear usuario
    function toggleBlockUser(email) {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        const updatedUsers = users.map(user => {
            if (user.email === email) {
                return { 
                    ...user, 
                    status: user.status === 'blocked' ? 'active' : 'blocked' 
                };
            }
            return user;
        });
        
        localStorage.setItem('spassoUsers', JSON.stringify(updatedUsers));
        
        // Si el usuario bloqueado es el actual, cerrar sesión
        if (currentUser && currentUser.email === email && updatedUsers.find(u => u.email === email).status === 'blocked') {
            logoutUser();
            showNotification('Tu cuenta ha sido bloqueada', 'error');
        } else {
            loadUsers();
            showNotification(`Usuario ${updatedUsers.find(u => u.email === email).status === 'blocked' ? 'bloqueado' : 'desbloqueado'}`, 'success');
        }
    }
    
    // Editar usuario
    function editUser(email) {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        const user = users.find(u => u.email === email);
        
        if (!user) {
            showNotification('Usuario no encontrado', 'error');
            return;
        }
        
        const newName = prompt('Nuevo nombre:', user.name);
        if (newName === null) return;
        
        const newEmail = prompt('Nuevo correo electrónico:', user.email);
        if (newEmail === null) return;
        
        // Validar nuevo email
        if (!/^\S+@\S+\.\S+$/.test(newEmail)) {
            showNotification('Ingresa un correo electrónico válido', 'error');
            return;
        }
        
        // Verificar si el nuevo email ya existe
        const emailExists = users.some(u => u.email === newEmail && u.email !== user.email);
        if (emailExists) {
            showNotification('El correo electrónico ya está en uso', 'error');
            return;
        }
        
        const updatedUsers = users.map(u => {
            if (u.email === email) {
                return { ...u, name: newName, email: newEmail };
            }
            return u;
        });
        
        localStorage.setItem('spassoUsers', JSON.stringify(updatedUsers));
        
        // Si el usuario editado es el actual, actualizar datos
        if (currentUser && currentUser.email === email) {
            currentUser.name = newName;
            currentUser.email = newEmail;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateUI();
        }
        
        loadUsers();
        showNotification('Usuario actualizado correctamente', 'success');
    }
    
    // Eliminar usuario
    function deleteUser(email) {
        if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
        
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        const updatedUsers = users.filter(user => user.email !== email);
        
        localStorage.setItem('spassoUsers', JSON.stringify(updatedUsers));
        
        // Si el usuario eliminado es el actual, cerrar sesión
        if (currentUser && currentUser.email === email) {
            logoutUser();
        }
        
        loadUsers();
        showNotification('Usuario eliminado correctamente', 'success');
    }
    
    // Cargar mensualidades en el panel de administración
    function loadMemberships(searchTerm = '') {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        membershipsList.innerHTML = '';
        
        // Filtrar usuarios si hay término de búsqueda
        const filteredUsers = searchTerm 
            ? users.filter(user => 
                user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                user.email.toLowerCase().includes(searchTerm.toLowerCase()))
            : users;
        
        if (filteredUsers.length === 0) {
            membershipsList.innerHTML = '<tr><td colspan="5">No se encontraron usuarios</td></tr>';
            return;
        }
        
        filteredUsers.forEach(user => {
            const row = document.createElement('tr');
            
            // Formatear fechas
            const startDate = user.membership.startDate 
                ? new Date(user.membership.startDate).toLocaleDateString('es-CL') 
                : 'No asignada';
            
            const endDate = user.membership.endDate 
                ? new Date(user.membership.endDate).toLocaleDateString('es-CL') 
                : 'No asignada';
            
            row.innerHTML = `
                <td>${user.name}</td>
                <td>${user.membership.plan || 'Ninguno'}</td>
                <td>${startDate}</td>
                <td>${endDate}</td>
                <td>
                    <span class="edit-membership" data-email="${user.email}">
                        <i class="fas fa-edit"></i> Editar
                    </span>
                </td>
            `;
            
            membershipsList.appendChild(row);
        });
        
        // Agregar event listeners a los botones de edición
        document.querySelectorAll('.edit-membership').forEach(btn => {
            btn.addEventListener('click', function() {
                editMembership(this.dataset.email);
            });
        });
    }
    
    // Editar mensualidad de usuario
    function editMembership(email) {
        const users = JSON.parse(localStorage.getItem('spassoUsers')) || sampleUsers;
        const user = users.find(u => u.email === email);
        
        if (!user) {
            showNotification('Usuario no encontrado', 'error');
            return;
        }
        
        // Obtener planes disponibles
        const plans = ['Ninguno', 'Básico', 'Premium', 'VIP'];
        
        // Crear formulario de edición
        const plan = prompt('Selecciona el plan:\n\n1. Básico\n2. Premium\n3. VIP\n\nIngresa el número del plan:', 
            plans.indexOf(user.membership.plan) + 1);
        
        if (plan === null) return;
        
        let selectedPlan = '';
        if (plan === '1') selectedPlan = 'Básico';
        else if (plan === '2') selectedPlan = 'Premium';
        else if (plan === '3') selectedPlan = 'VIP';
        else {
            showNotification('Opción no válida', 'error');
            return;
        }
        
        const startDate = prompt('Fecha de inicio (YYYY-MM-DD):', user.membership.startDate || '');
        if (startDate === null) return;
        
        // Validar fecha de inicio
        if (startDate && isNaN(new Date(startDate).getTime())) {
            showNotification('Fecha no válida', 'error');
            return;
        }
        
        const endDate = prompt('Fecha de término (YYYY-MM-DD):', user.membership.endDate || '');
        if (endDate === null) return;
        
        // Validar fecha de término
        if (endDate && isNaN(new Date(endDate).getTime())) {
            showNotification('Fecha no válida', 'error');
            return;
        }
        
        // Actualizar usuario
        const updatedUsers = users.map(u => {
            if (u.email === email) {
                return { 
                    ...u, 
                    membership: {
                        plan: selectedPlan,
                        startDate: startDate || '',
                        endDate: endDate || ''
                    }
                };
            }
            return u;
        });
        
        localStorage.setItem('spassoUsers', JSON.stringify(updatedUsers));
        
        // Si el usuario editado es el actual, actualizar datos
        if (currentUser && currentUser.email === email) {
            currentUser.membership = {
                plan: selectedPlan,
                startDate: startDate || '',
                endDate: endDate || ''
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            updateUI();
        }
        
        loadMemberships();
        showNotification('Membresía actualizada correctamente', 'success');
    }
    
    // Mostrar popup de WhatsApp con la promoción seleccionada
    function showWhatsappPopup(promoText) {
        whatsappMessage.textContent = `Estoy interesado en la promoción: ${promoText}`;
        const encodedMessage = encodeURIComponent(whatsappMessage.textContent);
        whatsappLink.href = `https://wa.me/73415902?text=${encodedMessage}`;
        whatsappPopup.style.display = 'block';
    }
    
    // Registrar ingreso al gimnasio
    function registerGymIncome() {
        if (!receptionistName.value || !receptionShiftSelect.value) {
            showNotification('Por favor completa tu nombre y turno', 'error');
            return;
        }
        
        // Redirigir al archivo python.html
        window.location.href = 'python.py';
    }
    
    // Cerrar sesión
    function logoutUser() {
        currentUser = null;
        localStorage.removeItem('currentUser');
        hideModal(profileModal);
        hideModal(adminModal);
        hideModal(receptionModal);
        updateUI();
        showNotification('Sesión cerrada correctamente', 'info');
    }
    
    // Mostrar popup de promociones al cargar la página
    let lastPopupTime = 0;

    function showPromoPopup() {
        const now = Date.now();
        const minTimeBetweenPopups = 5000; // 5 segundos entre popups
        
        if (now - lastPopupTime > minTimeBetweenPopups) {
            setTimeout(() => {
                promoPopup.style.display = 'block';
                lastPopupTime = now;
            }, 1000);
        }
    }

    document.addEventListener('DOMContentLoaded', showPromoPopup);
    
    // Event Listeners
    loginBtn.addEventListener('click', function() {
        if (currentUser) {
            showModal(profileModal);
            
            // Mostrar el menú correcto según el rol
            if (currentUser.role === 'admin' || currentUser.role === 'owner') {
                document.getElementById('adminControls').style.display = 'block';
                document.getElementById('receptionControls').style.display = 'none';
                switchAdminTab('users');
            } else if (currentUser.role === 'reception') {
                document.getElementById('adminControls').style.display = 'none';
                document.getElementById('receptionControls').style.display = 'block';
                
                // Configurar turno y nombre del recepcionista
                if (currentUser.shift) {
                    shiftSelect.value = currentUser.shift;
                    receptionShiftSelect.value = currentUser.shift;
                }
                if (currentUser.name) {
                    receptionistNameInput.value = currentUser.name;
                    receptionistName.value = currentUser.name;
                }
            } else {
                document.getElementById('adminControls').style.display = 'none';
                document.getElementById('receptionControls').style.display = 'none';
                switchTab('hombres');
            }
        } else {
            showModal(loginModal);
        }
    });
    
    showRegister.addEventListener('click', function(e) {
        e.preventDefault();
        hideModal(loginModal);
        showModal(registerModal);
    });
    
    showLogin.addEventListener('click', function(e) {
        e.preventDefault();
        hideModal(registerModal);
        showModal(loginModal);
    });
    
    closeModals.forEach(btn => {
        btn.addEventListener('click', function() {
            hideModal(loginModal);
            hideModal(registerModal);
            hideModal(profileModal);
            hideModal(adminModal);
            hideModal(receptionModal);
        });
    });
    
    closePopup.addEventListener('click', function() {
        promoPopup.style.display = 'none';
    });
    
    closeWhatsapp.addEventListener('click', function() {
        whatsappPopup.style.display = 'none';
    });
    
    // Cerrar modal al hacer clic fuera
    window.addEventListener('click', function(e) {
        if (e.target === loginModal) hideModal(loginModal);
        if (e.target === registerModal) hideModal(registerModal);
        if (e.target === profileModal) hideModal(profileModal);
        if (e.target === adminModal) hideModal(adminModal);
        if (e.target === receptionModal) hideModal(receptionModal);
        if (e.target === promoPopup) promoPopup.style.display = 'none';
        if (e.target === whatsappPopup) whatsappPopup.style.display = 'none';
    });
    
    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const isAdminLogin = document.getElementById('adminLogin').checked;
        const isReceptionLogin = document.getElementById('receptionLogin').checked;
        
        // Validar que no estén ambos checkboxes marcados
        if (isAdminLogin && isReceptionLogin) {
            showNotification('Solo puedes seleccionar un tipo de acceso a la vez', 'error');
            return;
        }
        
        // Si es admin o recepción, usar login local
        if (isAdminLogin || isReceptionLogin) {
            if (loginUser(email, password, isAdminLogin, isReceptionLogin)) {
                hideModal(loginModal);
                updateUI();
                
                // Mostrar el modal correspondiente según el rol
                if (currentUser.role === 'reception') {
                    showModal(receptionModal);
                } else {
                    showModal(profileModal);
                }
            }
        } else {
            // Login de socio via API
            try {
                const response = await loginSocio(email, password);
                showNotification('Bienvenido ' + (response.nombre || email), 'success');
                hideModal(loginModal);
                
                // Cargar dashboard del socio
                await loadDashboard();
                
            } catch (error) {
                showNotification(error.message || 'Error al iniciar sesión', 'error');
                console.error('Error login:', error);
            }
        }
    });
    
    registerForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const userData = {
            name: document.getElementById('registerName').value,
            email: document.getElementById('registerEmail').value,
            phone: document.getElementById('registerPhone').value,
            password: document.getElementById('registerPassword').value
        };
        
        if (registerUser(userData)) {
            currentUser = {
                ...userData,
                role: 'user',
                status: 'active',
                membership: {
                    plan: 'Ninguna',
                    startDate: '',
                    endDate: ''
                }
            };
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            hideModal(registerModal);
            updateUI();
            showModal(profileModal);
        }
    });
    
    logoutBtn.addEventListener('click', logoutUser);
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            switchTab(this.dataset.tab);
        });
    });
    
    levelBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const activeTab = document.querySelector('.tab-btn.active');
            switchLevel(this.dataset.level, activeTab.dataset.tab);
        });
    });
    
    adminTabBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            switchAdminTab(this.dataset.tab);
        });
    });
    
    editContentBtn.addEventListener('click', enableContentEditing);
    saveChangesBtn.addEventListener('click', disableContentEditing);
    
    manageUsersBtn.addEventListener('click', function() {
        hideModal(profileModal);
        showModal(adminModal);
        switchAdminTab('users');
    });
    
    manageMembershipsBtn.addEventListener('click', function() {
        hideModal(profileModal);
        showModal(adminModal);
        switchAdminTab('memberships');
    });
    
    // Botones de promoción - WhatsApp
    document.querySelectorAll('.promo-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const promoText = this.getAttribute('data-promo');
            showWhatsappPopup(promoText);
        });
    });
    
    // Botones de recepcionista
    registerGymIncomeBtn.addEventListener('click', registerGymIncome);
    registerSaunaIncomeBtn.addEventListener('click', function() {
        showNotification('Funcionalidad en desarrollo', 'info');
    });
    registerPoolIncomeBtn.addEventListener('click', function() {
        showNotification('Funcionalidad en desarrollo', 'info');
    });
    viewTodayClientsBtn.addEventListener('click', function() {
        showNotification('Funcionalidad en desarrollo', 'info');
    });
    
    registerIncomeBtn.addEventListener('click', function() {
        if (!receptionistNameInput.value || !shiftSelect.value) {
            showNotification('Por favor completa tu nombre y turno', 'error');
            return;
        }
        
        // Redirigir al archivo python.html
        window.location.href = 'python.html';
    });
    
    viewClientsBtn.addEventListener('click', function() {
        showNotification('Funcionalidad en desarrollo', 'info');
    });
    
    // Buscar usuarios
    searchUserBtn.addEventListener('click', function(e) {
        e.preventDefault();
        loadUsers(userSearch.value);
    });
    
    userSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            loadUsers(userSearch.value);
        }
    });
    
    // Buscar mensualidades
    searchMembershipBtn.addEventListener('click', function(e) {
        e.preventDefault();
        loadMemberships(membershipSearch.value);
    });
    
    membershipSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            loadMemberships(membershipSearch.value);
        }
    });
    
    // Scroll suave para enlaces
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
            
            // Actualizar enlace activo
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });
            this.classList.add('active');
        });
    });
    
    // Cambiar header al hacer scroll
    window.addEventListener('scroll', function() {
        const header = document.querySelector('header');
        if (window.scrollY > 50) {
            header.style.background = 'rgba(0, 0, 0, 0.9)';
            header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        } else {
            header.style.background = 'linear-gradient(135deg, var(--negro) 0%, var(--gris-oscuro) 100%)';
            header.style.boxShadow = '0 4px 30px rgba(0, 0, 0, 0.1)';
        }
    });
    
    // Inicialización
    function init() {
        createParticles();
        initHeroCarousel();
        switchTab('hombres');
        
        // Verificar sesión al cargar y actualizar UI
        const savedUser = localStorage.getItem('currentUser');
        if (savedUser) {
            currentUser = JSON.parse(savedUser);
            updateUI();
        }
        
        // Cargar datos de ejemplo si no existen
        if (!localStorage.getItem('spassoUsers')) {
            localStorage.setItem('spassoUsers', JSON.stringify(sampleUsers));
        }
        
        // Habilitar scroll horizontal inicial
        setTimeout(() => {
            enableHorizontalScroll();
        }, 200);
        
        // Mostrar popup de promociones
        showPromoPopup();
    }
    
    // Llamar a la inicialización
    init();
});