import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update, get } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

// Tu configuración exacta
const firebaseConfig = {
    apiKey: "AIzaSyDm1iRXGC0JhD8Cpl94WBy8YkQhuv54zlI",
    authDomain: "laesquinita-75d46.firebaseapp.com",
    projectId: "laesquinita-75d46",
    storageBucket: "laesquinita-75d46.firebasestorage.app",
    messagingSenderId: "247284442980",
    appId: "1:247284442980:web:b2b10dd782fee44c68bc71",
    measurementId: "G-RJ1BESWR2K"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const productsRef = ref(db, 'productos');
const categoriesRef = ref(db, 'categorias');

let currentCategoryId = "todos";
let products = [];
let categories = [];
let searchTerm = "";

// Elementos DOM
const scanInput = document.getElementById('scanInput');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const categoriesTabs = document.getElementById('categoriesTabs');
const productsContainer = document.getElementById('productsContainer');
const addCategoryBtn = document.getElementById('addCategoryBtn');
const exportDataBtn = document.getElementById('exportDataBtn');
const syncStatusSpan = document.getElementById('syncStatus');
const productModal = document.getElementById('productModal');
const modalTitle = document.getElementById('modalTitle');
const productForm = document.getElementById('productForm');
const closeModal = document.getElementById('closeModal');

// Toast
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden', 'bg-gray-800', 'bg-red-600');
    toast.classList.add(isError ? 'bg-red-600' : 'bg-gray-800');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Precio total
function calculateTotalPrice(cost, percent) {
    return (cost * (1 + percent / 100)).toFixed(2);
}

function updateTotalPriceField() {
    const cost = parseFloat(document.getElementById('costPrice').value) || 0;
    const percent = parseFloat(document.getElementById('profitPercent').value) || 0;
    document.getElementById('totalPrice').value = calculateTotalPrice(cost, percent);
}

document.getElementById('costPrice')?.addEventListener('input', updateTotalPriceField);
document.getElementById('profitPercent')?.addEventListener('input', updateTotalPriceField);

// Categorías y productos – carga inicial con timeout
let dataLoaded = false;

async function initialLoad() {
    // Timeout de 10 segundos
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 10000));
    try {
        const [catsSnap, prodsSnap] = await Promise.race([
            Promise.all([get(categoriesRef), get(productsRef)]),
            timeout
        ]);
        const catsData = catsSnap.val();
        categories = catsData ? Object.entries(catsData).map(([id, cat]) => ({ id, ...cat })) : [];
        if (categories.length === 0) {
            // Crear categorías por defecto
            const defaultCats = ["Bebidas", "Vinos", "Limpieza e Higiene", "Galletitas y snacks", "Comestibles", "Helados", "Cigarrillos", "Descartables", "Otros"];
            for (const nombre of defaultCats) {
                const newRef = push(categoriesRef);
                await set(newRef, { nombre });
                categories.push({ id: newRef.key, nombre });
            }
        }
        const prodsData = prodsSnap.val();
        products = prodsData ? Object.entries(prodsData).map(([id, prod]) => ({ id, ...prod })) : [];
        dataLoaded = true;
        renderCategoriesTabs();
        renderProducts();
        showToast("Inventario cargado", false);
        syncStatusSpan.innerHTML = '<i class="fas fa-check-circle"></i> Actualizado';
        setTimeout(() => {s
            syncStatusSpan.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sincronizado';
        }, 2000);

        // Suscribirse a cambios en tiempo real
        onValue(categoriesRef, (snap) => {
            const data = snap.val();
            categories = data ? Object.entries(data).map(([id, cat]) => ({ id, ...cat })) : [];
            if (categories.length === 0) return;
            renderCategoriesTabs();
            renderProducts();
        });
        onValue(productsRef, (snap) => {
            const data = snap.val();
            products = data ? Object.entries(data).map(([id, prod]) => ({ id, ...prod })) : [];
            renderProducts();
            showToast("Inventario actualizado", false);
            syncStatusSpan.innerHTML = '<i class="fas fa-check-circle"></i> Actualizado';
setTimeout(() => {
    syncStatusSpan.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sincronizado';
}, 2000);
        });
    } catch (error) {
        console.error('Error al cargar datos:', error);
        productsContainer.innerHTML = `
            <div class="p-8 text-center text-gray-500">
                <i class="fas fa-exclamation-triangle text-3xl mb-4 text-red-500"></i>
                <p class="mb-4">No se pudo conectar con la base de datos.</p>
                <p class="text-sm mb-4">Verificá las reglas de Firebase (deben permitir lectura y escritura).</p>
                <button id="retryLoadBtn" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">Reintentar</button>
            </div>
        `;
        document.getElementById('retryLoadBtn')?.addEventListener('click', () => {
            initialLoad();
        });
    }
}

// Renderizado de pestañas (sin cambios sustanciales)
function renderCategoriesTabs() {
    if (!categories.length) {
        categoriesTabs.innerHTML = '';
        return;
    }
    categoriesTabs.innerHTML = `
        <button data-cat="todos" class="category-tab px-4 py-2 rounded-t-lg font-medium ${currentCategoryId === 'todos' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}">
            Todos
        </button>
        ${categories.map(cat => `
            <div class="relative group inline-flex items-center gap-1">
                <button data-cat="${cat.id}" class="category-tab px-4 py-2 rounded-t-lg font-medium ${currentCategoryId === cat.id ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}">
                    ${escapeHtml(cat.nombre)}
                </button>
                <button data-cat-id="${cat.id}" class="edit-cat-btn text-xs bg-gray-400 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                    <i class="fas fa-pen"></i>
                </button>
                <button data-cat-id="${cat.id}" class="delete-cat-btn text-xs bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition ml-1">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('')}
        <button id="quickAddCat" class="ml-2 text-blue-600 hover:text-blue-800"><i class="fas fa-plus-circle"></i> Nueva</button>
    `;
    // Event listeners de categorías (idénticos a los anteriores, omitidos por brevedad pero incluidos en el archivo final)
    document.querySelectorAll('.category-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentCategoryId = btn.dataset.cat;
            renderCategoriesTabs();
            renderProducts();
        });
    });
    document.querySelectorAll('.edit-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const catId = btn.dataset.catId;
            const cat = categories.find(c => c.id === catId);
            const newName = prompt("Editar nombre de categoría:", cat.nombre);
            if (newName && newName.trim()) {
                update(ref(db, `categorias/${catId}`), { nombre: newName.trim() });
            }
        });
    });
    document.querySelectorAll('.delete-cat-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const catId = btn.dataset.catId;
            if (confirm("¿Eliminar categoría? Los productos pasarán a 'Otros'")) {
                const otrosId = categories.find(c => c.nombre === "Otros")?.id;
                if (otrosId) {
                    products.forEach(prod => {
                        if (prod.categoriaId === catId) {
                            update(ref(db, `productos/${prod.id}`), { categoriaId: otrosId });
                        }
                    });
                }
                remove(ref(db, `categorias/${catId}`));
            }
        });
    });
    document.getElementById('quickAddCat')?.addEventListener('click', () => {
        const newName = prompt("Nombre nueva categoría:");
        if (newName) {
            const newCatRef = push(categoriesRef);
            set(newCatRef, { nombre: newName });
        }
    });
}

// Renderizar productos (incluye botón de carga inicial)
function renderProducts() {
    let filtered = products;
    if (currentCategoryId !== "todos") {
        filtered = filtered.filter(p => p.categoriaId === currentCategoryId);
    }
    if (searchTerm) {
        filtered = filtered.filter(p =>
            p.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.codigo?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    // Botón de carga inicial si está vacío y hay categorías
    if (filtered.length === 0 && categories.length > 0 && products.length === 0 && dataLoaded) {
        productsContainer.innerHTML = `
            <div class="p-8 text-center text-gray-500">
                <i class="fas fa-box-open text-3xl mb-4"></i>
                <p class="mb-4">El inventario está vacío. ¿Querés cargar todos los productos iniciales?</p>
                <button id="seedInventoryBtn" class="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg shadow text-lg">
                    📦 Cargar inventario inicial
                </button>
            </div>
        `;
        document.getElementById('seedInventoryBtn')?.addEventListener('click', cargarInventarioInicial);
        return;
    }

    if (filtered.length === 0) {
        productsContainer.innerHTML = `<div class="p-8 text-center text-gray-500"><i class="fas fa-box-open"></i> No hay productos. Usá el escáner o botón +</div>`;
        return;
    }

    const isMobile = window.innerWidth < 768;
    if (isMobile) {
        productsContainer.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4">
                ${filtered.map(prod => `
                    <div class="card-hover bg-white border rounded-xl shadow-sm p-4 transition-all">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-bold text-lg">${escapeHtml(prod.nombre)}</h3>
                                <p class="text-xs text-gray-500 font-mono">${escapeHtml(prod.codigo || '')}</p>
                                <p class="text-sm mt-1">📅 ${prod.fechaIngreso || ''}</p>
                            </div>
                            <div class="flex gap-1">
                                <button data-id="${prod.id}" class="edit-product-btn text-blue-600"><i class="fas fa-edit"></i></button>
                                <button data-id="${prod.id}" class="delete-product-btn text-red-600"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                        <div class="grid grid-cols-2 gap-2 mt-3 text-sm">
                            <div><span class="font-semibold">Cant:</span> <span contenteditable="true" data-field="cantidad" data-id="${prod.id}" class="editable-field border-b border-dashed">${prod.cantidad || 0}</span></div>
                            <div><span class="font-semibold">Precio:</span> $<span contenteditable="true" data-field="precioCosto" data-id="${prod.id}" class="editable-field border-b border-dashed">${prod.precioCosto || 0}</span></div>
                            <div><span class="font-semibold">%Gan:</span> <span contenteditable="true" data-field="porcentajeGanancia" data-id="${prod.id}" class="editable-field border-b border-dashed">${prod.porcentajeGanancia || 30}</span></div>
                            <div><span class="font-semibold">Total:</span> $${prod.precioTotal || 0}</div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        productsContainer.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200">
                    <thead class="bg-gray-50">
                        <tr><th class="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Código</th>
                            <th class="px-4 py-3 text-left">Nombre</th>
                            <th class="px-4 py-3">Cantidad</th>
                            <th class="px-4 py-3">Costo</th>
                            <th class="px-4 py-3">%Gan</th>
                            <th class="px-4 py-3">Precio Total</th>
                            <th class="px-4 py-3">Fecha ingreso</th>
                            <th class="px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${filtered.map(prod => `
                            <tr>
                                <td class="px-4 py-2 text-sm font-mono">${escapeHtml(prod.codigo || '')}</td>
                                <td class="px-4 py-2 font-medium">${escapeHtml(prod.nombre)}</td>
                                <td class="px-4 py-2"><span contenteditable="true" data-field="cantidad" data-id="${prod.id}" class="editable-field inline-block min-w-[60px] border-b">${prod.cantidad || 0}</span></td>
                                <td class="px-4 py-2">$<span contenteditable="true" data-field="precioCosto" data-id="${prod.id}" class="editable-field inline-block min-w-[70px] border-b">${prod.precioCosto || 0}</span></td>
                                <td class="px-4 py-2"><span contenteditable="true" data-field="porcentajeGanancia" data-id="${prod.id}" class="editable-field inline-block min-w-[50px] border-b">${prod.porcentajeGanancia || 30}</span>%</td>
                                <td class="px-4 py-2 font-semibold">$${prod.precioTotal || 0}</td>
                                <td class="px-4 py-2 text-sm">${prod.fechaIngreso || ''}</td>
                                <td class="px-4 py-2">
                                    <button data-id="${prod.id}" class="edit-product-btn text-blue-600 mr-2"><i class="fas fa-edit"></i></button>
                                    <button data-id="${prod.id}" class="delete-product-btn text-red-600"><i class="fas fa-trash"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // Eventos inline (idénticos a la versión anterior)
    document.querySelectorAll('.editable-field').forEach(field => {
        field.addEventListener('blur', async (e) => {
            const productId = field.dataset.id;
            const fieldName = field.dataset.field;
            let newValue = field.innerText.trim();
            if (fieldName === 'cantidad' || fieldName === 'precioCosto' || fieldName === 'porcentajeGanancia') {
                newValue = parseFloat(newValue);
                if (isNaN(newValue)) return;
            }
            const productRef = ref(db, `productos/${productId}`);
            const updates = { [fieldName]: newValue };
            if (fieldName === 'precioCosto' || fieldName === 'porcentajeGanancia') {
                const prod = products.find(p => p.id === productId);
                const cost = fieldName === 'precioCosto' ? newValue : (prod?.precioCosto || 0);
                const percent = fieldName === 'porcentajeGanancia' ? newValue : (prod?.porcentajeGanancia || 30);
                updates.precioTotal = calculateTotalPrice(cost, percent);
            }
            await update(productRef, updates);
            showToast("Actualizado");
        });
    });
    document.querySelectorAll('.edit-product-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = btn.dataset.id;
            openProductModal(id);
        });
    });
    document.querySelectorAll('.delete-product-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.dataset.id;
            if (confirm("¿Eliminar producto permanentemente?")) {
                await remove(ref(db, `productos/${id}`));
                showToast("Producto eliminado");
            }
        });
    });
}

// Modal producto (sin cambios)
function openProductModal(id = null) {
    const form = document.getElementById('productForm');
    form.reset();
    document.getElementById('productId').value = '';
    modalTitle.innerText = id ? 'Editar Producto' : 'Nuevo Producto';
    const catSelect = document.getElementById('categorySelect');
    catSelect.innerHTML = categories.map(cat => `<option value="${cat.id}">${escapeHtml(cat.nombre)}</option>`).join('');
    if (id) {
        const prod = products.find(p => p.id === id);
        if (prod) {
            document.getElementById('productId').value = prod.id;
            document.getElementById('barcode').value = prod.codigo || '';
            document.getElementById('name').value = prod.nombre || '';
            document.getElementById('categorySelect').value = prod.categoriaId || '';
            document.getElementById('entryDate').value = prod.fechaIngreso || '';
            document.getElementById('quantity').value = prod.cantidad || 0;
            document.getElementById('costPrice').value = prod.precioCosto || 0;
            document.getElementById('profitPercent').value = prod.porcentajeGanancia || 30;
            updateTotalPriceField();
        }
    } else {
        if (currentCategoryId !== 'todos' && categories.some(c => c.id === currentCategoryId)) {
            document.getElementById('categorySelect').value = currentCategoryId;
        }
        document.getElementById('entryDate').value = new Date().toISOString().slice(0,10);
    }
    productModal.classList.remove('hidden');
    productModal.classList.add('flex');
}

productForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('productId').value;
    const codigo = document.getElementById('barcode').value.trim();
    const nombre = document.getElementById('name').value.trim();
    const categoriaId = document.getElementById('categorySelect').value;
    const fechaIngreso = document.getElementById('entryDate').value;
    const cantidad = parseInt(document.getElementById('quantity').value) || 0;
    const precioCosto = parseFloat(document.getElementById('costPrice').value) || 0;
    const porcentajeGanancia = parseFloat(document.getElementById('profitPercent').value) || 0;
    const precioTotal = calculateTotalPrice(precioCosto, porcentajeGanancia);
    const productData = { codigo, nombre, categoriaId, fechaIngreso, cantidad, precioCosto, porcentajeGanancia, precioTotal };
    if (id) {
        await update(ref(db, `productos/${id}`), productData);
        showToast("Producto actualizado");
    } else {
        const newRef = push(productsRef);
        await set(newRef, productData);
        showToast("Producto agregado");
    }
    productModal.classList.add('hidden');
    scanInput.focus();
});

closeModal.addEventListener('click', () => productModal.classList.add('hidden'));
window.addEventListener('click', (e) => {
    if (e.target === productModal) productModal.classList.add('hidden');
});

// Escáner (sin cambios)
let scanBuffer = "";
let scanTimeout;
scanInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const code = scanBuffer.trim();
        if (code) handleScannedBarcode(code);
        scanBuffer = "";
        e.preventDefault();
    } else if (e.key.length === 1) {
        scanBuffer += e.key;
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => { scanBuffer = ""; }, 500);
    }
});

async function handleScannedBarcode(code) {
    const existing = products.find(p => p.codigo === code);
    if (existing) {
        const newQty = prompt(`Producto encontrado: ${existing.nombre}\nCantidad actual: ${existing.cantidad}\nNueva cantidad (o cancelar):`);
        if (newQty !== null && !isNaN(parseFloat(newQty))) {
            await update(ref(db, `productos/${existing.id}`), { cantidad: parseInt(newQty) });
            showToast(`Cantidad actualizada a ${newQty}`);
        }
    } else {
        openProductModal();
        document.getElementById('barcode').value = code;
        document.getElementById('name').focus();
        showToast("Escaneado: complete el formulario", false);
    }
    scanInput.value = "";
    scanInput.focus();
}

// Buscador
searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderProducts();
});
clearSearchBtn.addEventListener('click', () => {
    searchInput.value = "";
    searchTerm = "";
    renderProducts();
});

// Exportar
exportDataBtn.addEventListener('click', () => {
    const dataStr = JSON.stringify({ productos: products, categorias: categories }, null, 2);
    const blob = new Blob([dataStr], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventario_laesquinita_${new Date().toISOString().slice(0,19)}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

addCategoryBtn.addEventListener('click', () => {
    const newName = prompt("Nombre nueva categoría:");
    if (newName) {
        const newCatRef = push(categoriesRef);
        set(newCatRef, { nombre: newName });
    }
});

async function cargarInventarioInicial() {
    const productosSemilla = [
        // Bebidas
        ["Santa fé Pilsen x 1L", "Bebidas", 11, 31900],
        ["Schneider x 1L", "Bebidas", 10, 27500],
        ["Stella Artois x 1L", "Bebidas", 3, 12300],
        ["Corona x 710", "Bebidas", 5, 21000],
        ["Latita Schneider", "Bebidas", 13, 22100],
        ["Latita Santa fé Pilsen y Común", "Bebidas", 25, 42500],
        ["Latita Imperial", "Bebidas", 4, 9500],
        ["Latita Stella", "Bebidas", 4, 8400],
        ["Latita Heineken", "Bebidas", 2, 4800],
        ["Latones Schneider", "Bebidas", 6, 11500],
        // Vinos
        ["Cosecha Tardía", "Vinos", 3, 9000],
        ["Chacabuco", "Vinos", 3, 14400],
        ["Dilema", "Vinos", 7, 23800],
        ["Otro loco mas", "Vinos", 3, null, 3500],   // precio unitario
        ["Norton clásico", "Vinos", 2, 6000],
        ["Alma Mora", "Vinos", 6, 23800],
        ["Canciller blanco", "Vinos", 3, 5300],
        ["Amargo obrero", "Vinos", 3, 13500],
        ["TORO Caja", "Vinos", 8, 15000],
        ["Sidra 1888", "Vinos", 4, 22000],
        ["Sidra La Farruca", "Vinos", 7, 14800],
        ["Frize", "Vinos", 5, 12500],
        ["Pronto", "Vinos", 4, 13200],
        ["Gancia botella", "Vinos", 4, 27200],
        // Bebidas (continuación)
        ["Agua mineral x 2L", "Bebidas", 4, 4000],
        ["Levite x 1.5L", "Bebidas", 20, 34000],
        ["Placer x 1.5L", "Bebidas", 20, 20000],
        ["Smirnoff", "Bebidas", 3, 21000],
        ["Fernet Vittone x 1L", "Bebidas", 3, 15000],
        ["Fernet Branca x 450", "Bebidas", 1, 9000],
        ["Pepsi x 2L", "Bebidas", 11, 27500],
        ["Cepita botella", "Bebidas", 5, 15000],
        ["Paso de los Toros", "Bebidas", 12, 32400],
        ["Coca de vidrio", "Bebidas", 3, 7500],
        ["Fanta y Sprite retornable", "Bebidas", 6, 18000],
        ["Pritty x 2L", "Bebidas", 3, 5700],
        ["Fanta x 1.5L", "Bebidas", 4, 12000],
        ["Coca y Sprite x 1.5L", "Bebidas", 5, 15000],
        ["Sprite y Coca des. x 2.25L", "Bebidas", 7, 30000],
        ["Manaos x 3L", "Bebidas", 11, 18700],
        ["Speed chiquito", "Bebidas", 6, 9000],
        ["Speed grande", "Bebidas", 2, 4000],
        ["Red Bull", "Bebidas", 5, 12000],
        ["Monster", "Bebidas", 10, 24000],
        ["Dr Lemon Latita", "Bebidas", 11, 17600],
        ["Botellitas x500 (Coca,Fanta,Sprite)", "Bebidas", 27, 32400],
        ["Agua saborizadas x500", "Bebidas", 46, 23000],
        ["Baggio chiquito", "Bebidas", 30, 19500],
        ["Baggio x 1L", "Bebidas", 18, 30600],
        ["Latitas de gaseosas", "Bebidas", 10, 9000],
        ["Powerade y Gatorade", "Bebidas", 15, 24000],
        ["Petaca café al coñac", "Bebidas", 2, 2000],
        ["Licores", "Bebidas", 2, 7000],
        // Limpieza e Higiene
        ["Toallitas y Protectores", "Limpieza e Higiene", 23, 18500],
        ["Papel Higiénico Campanita", "Limpieza e Higiene", 2, 3000],
        ["Algodón", "Limpieza e Higiene", 2, 1600],
        ["Servilletas x3", "Limpieza e Higiene", 5, 8000],
        ["Pañales x48", "Limpieza e Higiene", 2, 23000],
        ["Dentífrico Odol", "Limpieza e Higiene", 2, 4000],
        ["Desodorante Piso Poett", "Limpieza e Higiene", 2, 3600],
        ["Desinfectante genérico", "Limpieza e Higiene", 3, 5000],
        ["Lavandina", "Limpieza e Higiene", 5, 5000],
        ["Alcohol", "Limpieza e Higiene", 3, 4200],
        ["Repuestos Magistral", "Limpieza e Higiene", 2, 3600],
        ["Guantes de látex", "Limpieza e Higiene", 3, 1800],
        ["Pañitas", "Limpieza e Higiene", 2, 3600],
        ["Fuyi aerosol", "Limpieza e Higiene", 2, 8800],
        ["Lisoform aerosol", "Limpieza e Higiene", 2, 5000],
        ["Camellito", "Limpieza e Higiene", 2, 3800],
        ["Jabón en polvo", "Limpieza e Higiene", 12, 12000],
        ["Pilas, encendedor, maquinitas", "Limpieza e Higiene", 1, 20000],
        // Galletitas y snacks
        ["Papas Class x85g", "Galletitas y snacks", 8, 7600],
        ["Galletitas Pepas La Nova", "Galletitas y snacks", 3, 2100],
        ["Galletitas Don Satur", "Galletitas y snacks", 5, 5300],
        ["Criollitas saladas x3", "Galletitas y snacks", 5, 4500],
        ["Galletitas 9 de Oro", "Galletitas y snacks", 8, 8800],
        ["Surtidas Bagley/Diversión", "Galletitas y snacks", 8, 19500],
        ["Chocolatada x 1L", "Galletitas y snacks", 4, 10400],
        ["Sachet leche entera", "Galletitas y snacks", 7, 9800],
        ["Caramelos surtidos", "Galletitas y snacks", 1, 20000],
        // Comestibles
        ["Mayonesa Natura x250", "Comestibles", 3, 3900],
        ["Ketchup Natura x250", "Comestibles", 4, 5200],
        ["Mayonesa Natura x125", "Comestibles", 16, 9600],
        ["Miel x500", "Comestibles", 2, 2800],
        ["Miel x250", "Comestibles", 2, 2000],
        ["Sal fina x500", "Comestibles", 3, 1200],
        ["Sal gruesa x1kg", "Comestibles", 2, 1300],
        ["Chocolate Águila x200", "Comestibles", 4, 5600],
        ["Café La Virginia (frasco)", "Comestibles", 2, 8600],
        ["Caja té La Virginia", "Comestibles", 4, 3200],
        ["Caja mate cocido", "Comestibles", 5, 4000],
        ["Caja boldo", "Comestibles", 2, 3000],
        ["Caja manzanilla", "Comestibles", 3, 5400],
        ["Té de limón", "Comestibles", 4, 5600],
        ["Maíz Pisingallo", "Comestibles", 2, 1200],
        ["Alimento gato (5 bolsas)", "Comestibles", 5, 3000],
        ["Alimento perro (9 paq.)", "Comestibles", 9, 9000],
        ["Jugos Tang / Rinde2", "Comestibles", 100, 32500],
        ["Vinagre de manzana", "Comestibles", 5, 3500],
        ["Yerba Aguantadora x250", "Comestibles", 10, 9000],
        ["Yerba Aguantadora x500", "Comestibles", 9, 16200],
        ["Yerba Rosamonte x500", "Comestibles", 5, 9000],
        ["Harina Cañuelas Común", "Comestibles", 9, 7200],
        ["Harina Rebozarina", "Comestibles", 2, 2400],
        ["Bicarbonato x50g", "Comestibles", 6, 3600],
        ["Orégano x25g", "Comestibles", 2, 2200],
        ["Salsa lista pizza", "Comestibles", 5, 5500],
        ["Fideos La Providencia", "Comestibles", 15, 12000],
        ["Fideos Bonanza", "Comestibles", 6, 5400],
        ["Fideos San Agustín", "Comestibles", 4, 3600],
        ["Fideos Spaghetti Terrabusi", "Comestibles", 8, 8000],
        ["Arroz x500", "Comestibles", 8, 7200],
        ["Bidón de agua x6L", "Comestibles", 4, 10300],
        // Helados
        ["Palito bombón + caja", "Helados", 11, 28700],
        ["Palito Crema", "Helados", 13, 8000],
        ["Copas Suspiro", "Helados", 12, 20760],
        ["Copas Fruti Placer", "Helados", 7, 6600],
        ["Palitos Crocante", "Helados", 10, 7800],
        ["Potes x3L", "Helados", 3, 31500],
        ["Bolsas juguitos", "Helados", 2, 6000],
        ["Caja bombón escocés", "Helados", 1, 27000],
        ["Caja alfajor helado", "Helados", 1, 27000],
        ["Bolsas palito de agua", "Helados", 2, 23000],
        // Cigarrillos
        ["Philips 10 Convertible", "Cigarrillos", 3, 7200],
        ["Malboro 10 Común", "Cigarrillos", 6, 15000],
        ["Lucky 20 box Común", "Cigarrillos", 1, 4000],
        ["Lucky 10 Común y Convert", "Cigarrillos", 7, 18200],
        ["Malboro 10 UVA", "Cigarrillos", 7, 18200],
        ["Camel 20 Común", "Cigarrillos", 3, 11700],
        ["Philips 20 box Convertible", "Cigarrillos", 1, 3800],
        ["Malboro 20 box UVA y Común", "Cigarrillos", 3, 12000],
        ["Chesterfield 10 Común", "Cigarrillos", 5, 9000],
        ["Paris Lucky 20 box", "Cigarrillos", 1, 5000],
        ["Papelillo OCB negra", "Cigarrillos", 10, 4000],
        // Descartables
        ["Descartables (lote)", "Descartables", 1, 50000],
        ["Medallones", "Descartables", 19, 19000],
        ["Hamburguesas (un.)", "Descartables", 14, 3000],
        ["Hielo (bolsas)", "Descartables", 15, 18000],
        // Ticket nuevos (usa precio unitario)
        ["DOVER BOX", "Cigarrillos", 4, null, 1300],
        ["MARLBORO CRAFTED", "Cigarrillos", 4, null, 3300],
        ["MARLBORO CRAFTED (2do)", "Cigarrillos", 4, null, 3300],
        ["PHILIP MORRIS RED", "Cigarrillos", 4, null, 2300],
        ["MARLBORO CRAFTED (3ro)", "Cigarrillos", 4, null, 3300],
        ["LUCKY STRIKE ORIG", "Cigarrillos", 4, null, 3300],
        ["LUCKY ROJO", "Cigarrillos", 4, null, 2300],
        ["LIVERPOOL BOX", "Cigarrillos", 4, null, 1600],
        ["LIVERPOOL BLUEPOP", "Cigarrillos", 4, null, 1800],
        ["LIVERPOOL GREEN", "Cigarrillos", 4, null, 1600],
        ["LUCKY STRIKE 12 C", "Cigarrillos", 4, null, 3300],
        ["CHESTERFIELD 10 F", "Cigarrillos", 4, null, 2900],
        ["CHESTERFIELD 12", "Cigarrillos", 4, null, 2900],
        ["PETACA CAFE AL CO", "Bebidas", 15, null, 1550],
        ["CIRCUS FIERITA 30", "Galletitas y snacks", 1, null, 2300],
        ["GOMITAS FANTASIA", "Galletitas y snacks", 1, null, 9400],
        ["F CARM. BUTER TOF", "Galletitas y snacks", 1, null, 2700],
        ["F CARAM. ALKA X10", "Galletitas y snacks", 2, null, 2600],
        ["F CARAM RELLENO M", "Galletitas y snacks", 1, null, 2300],
        ["RODESIA", "Galletitas y snacks", 2, null, 2100],
        ["MENTHOPLUS STRONG", "Galletitas y snacks", 24, null, 550],
        ["PRESTOBARBA", "Limpieza e Higiene", 4, null, 1100],
        ["CALIPSO NORMAL Verde", "Limpieza e Higiene", 3, null, 1155],
        ["CALIPSO NORMAL Rosa", "Limpieza e Higiene", 3, null, 945],
        ["TOALLA DONCELLA N", "Limpieza e Higiene", 3, null, 1300],
        ["ALGODON Y", "Limpieza e Higiene", 1, null, 1500],
        ["DONCELLA NOC.", "Limpieza e Higiene", 1, null, 1200]
    ];

    try {
        showToast("⏳ Cargando inventario inicial...");
        const catsSnap = await get(categoriesRef);
        const catsData = catsSnap.val() || {};
        const catMap = {};
        for (const [id, obj] of Object.entries(catsData)) {
            catMap[obj.nombre] = id;
        }
        const todasLasCat = [...new Set(productosSemilla.map(p => p[1]))];
        for (const nombreCat of todasLasCat) {
            if (!catMap[nombreCat]) {
                const newRef = push(categoriesRef);
                await set(newRef, { nombre: nombreCat });
                catMap[nombreCat] = newRef.key;
            }
        }
        for (const [nombre, categoria, cantidad, costoTotal, precioUnitario] of productosSemilla) {
            const catId = catMap[categoria] || catMap["Otros"];
            let precioCosto = precioUnitario ?? (costoTotal ? Math.round(costoTotal / cantidad) : 0);
            const productData = {
                codigo: '',
                nombre,
                categoriaId: catId,
                fechaIngreso: new Date().toISOString().slice(0, 10),
                cantidad,
                precioCosto,
                porcentajeGanancia: 30,
                precioTotal: calculateTotalPrice(precioCosto, 30)
            };
            const newRef = push(productsRef);
            await set(newRef, productData);
        }
        showToast("✅ Inventario inicial cargado con éxito");
    } catch (error) {
        showToast("❌ Error al cargar inventario", true);
        console.error(error);
    }
}

// Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[m] || m);
}

// Inicialización
initialLoad();

// Foco inteligente
scanInput.focus();
document.addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !e.target.isContentEditable) {
        scanInput.focus();
    }
});
window.addEventListener('resize', () => renderProducts());