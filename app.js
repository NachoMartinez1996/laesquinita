import { initializeApp } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js";
import { getDatabase, ref, set, push, onValue, remove, update } from "https://www.gstatic.com/firebasejs/12.14.0/firebase-database.js";

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

// Referencias
const productsRef = ref(db, 'productos');
const categoriesRef = ref(db, 'categorias');

// Estado global
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

// Helper: mostrar toast
function showToast(msg, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden', 'bg-gray-800', 'bg-red-600');
    toast.classList.add(isError ? 'bg-red-600' : 'bg-gray-800');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

// Calcular precio total
function calculateTotalPrice(cost, percent) {
    return (cost * (1 + percent / 100)).toFixed(2);
}

// Actualizar campo precio total en modal
function updateTotalPriceField() {
    const cost = parseFloat(document.getElementById('costPrice').value) || 0;
    const percent = parseFloat(document.getElementById('profitPercent').value) || 0;
    document.getElementById('totalPrice').value = calculateTotalPrice(cost, percent);
}

// Escuchar cambios en costo y porcentaje
document.getElementById('costPrice')?.addEventListener('input', updateTotalPriceField);
document.getElementById('profitPercent')?.addEventListener('input', updateTotalPriceField);

// Cargar categorías desde Firebase
function loadCategories() {
    onValue(categoriesRef, (snapshot) => {
        const data = snapshot.val();
        categories = data ? Object.entries(data).map(([id, cat]) => ({ id, ...cat })) : [];
        if (categories.length === 0) {
            // Categorías por defecto (basadas en tu data)
            const defaultCats = ["Bebidas", "Vinos", "Limpieza e Higiene", "Galletitas y snacks", "Comestibles", "Helados", "Cigarrillos", "Descartables", "Otros"];
            defaultCats.forEach(cat => {
                const newCatRef = push(categoriesRef);
                set(newCatRef, { nombre: cat });
            });
        }
        renderCategoriesTabs();
    });
}

// Renderizar pestañas de categorías (editables)
function renderCategoriesTabs() {
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
    // Event listeners
    document.querySelectorAll('.category-tab').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentCategoryId = btn.dataset.cat;
            renderCategoriesTabs(); // refrescar estilo
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

// Cargar productos
function loadProducts() {
    onValue(productsRef, (snapshot) => {
        const data = snapshot.val();
        products = data ? Object.entries(data).map(([id, prod]) => ({ id, ...prod })) : [];
        renderProducts();
        showToast("Inventario actualizado");
        syncStatusSpan.innerHTML = '<i class="fas fa-check-circle"></i> Actualizado';
        setTimeout(() => {
            syncStatusSpan.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sincronizado';
        }, 2000);
    });
}

// Renderizar productos (tabla o cards según ancho)
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
    // Vincular eventos de edición inline
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
    // ⚠️ CORRECCIÓN CRÍTICA: leer correctamente el id del botón
    document.querySelectorAll('.delete-product-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = btn.dataset.id;   // ← antes faltaba esta línea y causaba error
            if (confirm("¿Eliminar producto permanentemente?")) {
                await remove(ref(db, `productos/${id}`));
                showToast("Producto eliminado");
            }
        });
    });
}

// Modal: crear/editar
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

closeModal.addEventListener('click', () => {
    productModal.classList.add('hidden');
});
window.addEventListener('click', (e) => {
    if (e.target === productModal) productModal.classList.add('hidden');
});

// Lógica del escáner MEJORADA
let scanBuffer = "";
let scanTimeout;
scanInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const code = scanBuffer.trim();
        if (code) {
            handleScannedBarcode(code);
        }
        scanBuffer = "";
        e.preventDefault();
    } else if (e.key.length === 1) { // solo caracteres imprimibles
        scanBuffer += e.key;
        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => { scanBuffer = ""; }, 500); // mayor timeout
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

// Buscador reactivo
searchInput.addEventListener('input', (e) => {
    searchTerm = e.target.value;
    renderProducts();
});
clearSearchBtn.addEventListener('click', () => {
    searchInput.value = "";
    searchTerm = "";
    renderProducts();
});

// Exportar a JSON
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

// Funciones auxiliares
function escapeHtml(str) { if(!str) return ''; return str.replace(/[&<>]/g, function(m){ if(m === '&') return '&amp;'; if(m === '<') return '&lt;'; if(m === '>') return '&gt;'; return m;}); }

// Inicialización
loadCategories();
loadProducts();

// Foco inteligente para el escáner (sin setInterval molesto)
scanInput.focus();
document.addEventListener('click', (e) => {
    // Si el clic no fue en un campo de texto, devolvemos el foco al escáner
    if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !e.target.isContentEditable) {
        scanInput.focus();
    }
});

// Re-renderizar al cambiar el tamaño de la pantalla (para alternar entre tabla y cards)
window.addEventListener('resize', () => {
    renderProducts();
});