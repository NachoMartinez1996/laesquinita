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
        setTimeout(() => {
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

// Carga inicial masiva (invocada desde el botón en la interfaz)
async function cargarInventarioInicial() {
    const productosSemilla = [
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
        // ... (la lista completa, igual que antes)
        ["DONCELLA NOC.", "Limpieza e Higiene", 1, 1200]
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