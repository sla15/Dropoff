import React, { useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, Camera, Edit2, Phone, MapPin as MapPinFilled, Clock, Truck, Package, Plus, X, ImageIcon, Check, ChevronDown, Store as StoreIcon } from 'lucide-react';
import { Theme, Screen, Product } from '../types';
import { triggerHaptic } from '../utils/helpers';
import { STORE_CATEGORIES, PRODUCT_CATEGORIES } from '../data';
import { BottomNav } from '../components/Navigation';

interface Props {
    theme: Theme;
    navigate: (scr: Screen) => void;
    isScrolling: boolean;
}

export const StoreScreen = ({ theme, navigate, isScrolling }: Props) => {
    const [view, setView] = useState<'intro' | 'wizard' | 'add-product' | 'dashboard'>('intro');
    const [wizardStep, setWizardStep] = useState(1);
    const totalSteps = 4;

    const [storeName, setStoreName] = useState('');
    const [storeCategory, setStoreCategory] = useState('');
    const [storePhone, setStorePhone] = useState('');
    const [qmoneyEnabled, setQmoneyEnabled] = useState(true);
    const [inventory, setInventory] = useState<Product[]>([]);

    const [newProduct, setNewProduct] = useState<Partial<Product>>({
        name: '',
        price: 0,
        mainCategory: '',
        categories: [],
        description: '',
        stock: 1
    });

    const [tagInput, setTagInput] = useState('');
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const bgMain = theme === 'light' ? 'bg-[#F2F2F7]' : 'bg-[#000000]';
    const bgCard = theme === 'light' ? 'bg-[#FFFFFF]' : 'bg-[#1C1C1E]';
    const textMain = theme === 'light' ? 'text-[#000000]' : 'text-[#FFFFFF]';
    const textSec = theme === 'light' ? 'text-[#8E8E93]' : 'text-[#98989D]';
    const inputBg = theme === 'light' ? 'bg-[#E5E5EA]' : 'bg-[#2C2C2E]';
    const separator = theme === 'light' ? 'border-gray-200' : 'border-gray-800';

    const handleAddProduct = () => {
        if (!newProduct.name || !newProduct.price) return;

        const product: Product = {
            id: Math.random().toString(36).substr(2, 9),
            name: newProduct.name!,
            price: Number(newProduct.price),
            description: newProduct.description || '',
            mainCategory: newProduct.mainCategory || 'Other',
            categories: newProduct.categories || [],
            stock: Number(newProduct.stock) || 1,
            image: previewImage || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=800&q=80'
        };

        setInventory([...inventory, product]);
        setView('wizard');
        setWizardStep(4);
        setNewProduct({ name: '', price: 0, mainCategory: '', categories: [], description: '', stock: 1 });
        setTagInput('');
        setPreviewImage(null);
    };

    const triggerImageUpload = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreviewImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const addTag = () => {
        if (tagInput.trim()) {
            const newTags = [...(newProduct.categories || [])];
            if (!newTags.includes(tagInput.trim())) {
                newTags.push(tagInput.trim());
                setNewProduct({ ...newProduct, categories: newTags });
            }
            setTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        const newTags = (newProduct.categories || []).filter(t => t !== tag);
        setNewProduct({ ...newProduct, categories: newTags });
    };

    const getStepTitle = (step: number) => {
        switch (step) {
            case 1: return "Essentials";
            case 2: return "Logistics";
            case 3: return "Payments";
            case 4: return "Inventory";
            default: return "";
        }
    };

    if (view === 'add-product') {
        return (
            <div className={`h-full w-full ${bgMain} ${textMain} flex flex-col animate-slide-in relative`}>
                <div className={`px-6 pt-safe pb-4 flex items-center justify-between sticky top-0 z-20 ${bgMain} border-b ${separator}`}>
                    <button onClick={() => { setView('wizard'); setWizardStep(4); }}><ArrowLeft className="cursor-pointer" /></button>
                    <h1 className="font-bold text-lg">Add Product</h1>
                    <div className="w-6"></div>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-6 pb-32 space-y-6">
                    <div className="flex justify-center">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                        <div
                            onClick={triggerImageUpload}
                            className={`w-32 h-32 rounded-2xl ${inputBg} flex flex-col items-center justify-center border-2 border-dashed border-gray-400 dark:border-gray-600 cursor-pointer overflow-hidden relative group`}
                        >
                            {previewImage ? (
                                <>
                                    <img src={previewImage} className="w-full h-full object-cover" alt="Product Preview" />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <Edit2 size={24} className="text-white" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <ImageIcon size={32} className="opacity-50 mb-2" />
                                    <span className="text-xs font-bold opacity-50">Upload Image</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className={`text-sm font-bold ${textSec} mb-1 block`}>Product Name</label>
                            <input
                                value={newProduct.name}
                                onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                                placeholder="e.g. Avocado Toast"
                                className={`w-full p-4 rounded-xl ${theme === 'light' ? 'bg-[#E5E5EA]/50 border border-white/40' : 'bg-[#2C2C2E]/50 border border-white/5'} backdrop-blur-md outline-none font-medium`}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={`text-sm font-bold ${textSec} mb-1 block`}>Price (D)</label>
                                <input
                                    type="number"
                                    value={newProduct.price || ''}
                                    onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
                                    placeholder="0.00"
                                    className={`w-full p-4 rounded-xl ${theme === 'light' ? 'bg-[#E5E5EA]/50 border border-white/40' : 'bg-[#2C2C2E]/50 border border-white/5'} backdrop-blur-md outline-none font-medium`}
                                />
                            </div>
                            <div>
                                <label className={`text-sm font-bold ${textSec} mb-1 block`}>Stock</label>
                                <input
                                    type="number"
                                    value={newProduct.stock}
                                    onChange={(e) => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) })}
                                    className={`w-full p-4 rounded-xl ${inputBg} outline-none font-medium`}
                                    placeholder="1"
                                />
                            </div>
                        </div>

                        <div>
                            <label className={`text-sm font-bold ${textSec} mb-1 block`}>Product Category</label>
                            <div className="relative">
                                <select
                                    value={newProduct.mainCategory}
                                    onChange={(e) => setNewProduct({ ...newProduct, mainCategory: e.target.value })}
                                    className={`w-full p-4 rounded-xl ${inputBg} outline-none font-medium appearance-none`}
                                >
                                    <option value="" disabled>Select Category</option>
                                    {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <ChevronDown className={`absolute right-4 top-1/2 -translate-y-1/2 ${textSec}`} size={20} pointerEvents="none" />
                            </div>
                        </div>

                        <div>
                            <label className={`text-sm font-bold ${textSec} mb-1 block`}>Types / Variations</label>
                            <div className={`w-full p-2 rounded-xl ${inputBg} flex flex-wrap gap-2 min-h-[56px] items-center`}>
                                {newProduct.categories?.map(tag => (
                                    <span key={tag} className="bg-white dark:bg-black px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 shadow-sm animate-scale-in">
                                        {tag}
                                        <X size={14} className="cursor-pointer opacity-50 hover:opacity-100" onClick={() => removeTag(tag)} />
                                    </span>
                                ))}
                                <div className="flex-1 flex items-center gap-2 min-w-[120px]">
                                    <input
                                        value={tagInput}
                                        onChange={(e) => setTagInput(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ',') {
                                                e.preventDefault();
                                                addTag();
                                            }
                                        }}
                                        className="flex-1 bg-transparent outline-none font-medium p-2"
                                        placeholder="Add variation (e.g. XL, Spicy)"
                                    />
                                    {tagInput && (
                                        <button
                                            onClick={addTag}
                                            className="w-8 h-8 rounded-full bg-[#00D68F] text-black flex items-center justify-center shadow-sm active:scale-90 transition-transform"
                                        >
                                            <Plus size={16} strokeWidth={3} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs opacity-50 mt-1 ml-1">Press Enter to add tags for size, color, or options.</p>
                        </div>

                        <div>
                            <label className={`text-sm font-bold ${textSec} mb-1 block`}>Description</label>
                            <textarea
                                value={newProduct.description}
                                onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                                className={`w-full p-4 rounded-xl ${inputBg} outline-none font-medium min-h-[100px] resize-none`}
                                placeholder="Describe your product..."
                            />
                        </div>
                    </div>
                </div>

                <div className={`p-4 ${theme === 'light' ? 'bg-white/90' : 'bg-[#1C1C1E]/90'} backdrop-blur-md border-t ${separator} pb-safe`}>
                    <button
                        onClick={handleAddProduct}
                        disabled={!newProduct.name || !newProduct.price}
                        className="w-full bg-[#00D68F] text-black py-4 rounded-full font-bold text-lg shadow-lg disabled:opacity-50"
                    >
                        Save Product
                    </button>
                </div>
            </div>
        );
    }

    if (view === 'wizard') {
        return (
            <div className={`h-full w-full ${bgMain} ${textMain} flex flex-col animate-slide-in relative`}>
                {/* Wizard Header */}
                <div className={`px-6 pt-safe pb-4 flex flex-col sticky top-0 z-20 ${bgMain} border-b ${separator}`}>
                    <div className="flex items-center gap-4 mb-4">
                        <button onClick={() => wizardStep > 1 ? setWizardStep(prev => prev - 1) : setView('intro')} className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"><ArrowLeft size={24} /></button>
                        <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-[#00D68F] transition-all duration-500 ease-out" style={{ width: `${(wizardStep / totalSteps) * 100}%` }}></div>
                        </div>
                        <span className={`text-xs font-bold ${textSec}`}>Step {wizardStep}/{totalSteps}</span>
                    </div>
                    <h1 className="text-2xl font-bold">{getStepTitle(wizardStep)}</h1>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-6 pb-32">

                    {/* Step 1: Essentials */}
                    {wizardStep === 1 && (
                        <div className="space-y-6 animate-scale-in">
                            <div className="flex justify-center mb-2">
                                <div className="w-24 h-24 rounded-full border-2 border-dashed border-gray-300 dark:border-gray-700 flex items-center justify-center relative bg-black/5 dark:bg-white/5">
                                    <Camera className="text-[#00D68F]" />
                                    <div className="absolute bottom-0 right-0 bg-[#00D68F] w-7 h-7 rounded-full flex items-center justify-center border-2 border-[#F2F2F7] dark:border-black">
                                        <Edit2 size={12} className="text-black" />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className={`text-sm font-medium ${textSec} mb-1 block`}>Business Name</label>
                                <input
                                    value={storeName}
                                    onChange={(e) => setStoreName(e.target.value)}
                                    placeholder="The Green Grocer"
                                    className={`w-full p-4 rounded-xl ${theme === 'light' ? 'bg-[#E5E5EA]/50 border border-white/40' : 'bg-[#2C2C2E]/50 border border-white/5'} backdrop-blur-md outline-none font-medium`}
                                />
                            </div>

                            <div>
                                <label className={`text-sm font-medium ${textSec} mb-2 block`}>Category</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {STORE_CATEGORIES.map(cat => (
                                        <button
                                            key={cat}
                                            onClick={() => setStoreCategory(cat)}
                                            className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${storeCategory === cat ? 'border-[#00D68F] bg-[#00D68F]/10 text-[#00D68F]' : 'border-transparent bg-gray-100 dark:bg-gray-800'}`}
                                        >
                                            {cat}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className={`text-sm font-medium ${textSec} mb-1 block`}>Phone Number</label>
                                <div className={`flex items-center gap-3 p-4 rounded-xl ${inputBg}`}>
                                    <Phone size={20} className={textSec} />
                                    <input
                                        value={storePhone}
                                        onChange={(e) => setStorePhone(e.target.value)}
                                        placeholder="+220 1234 567"
                                        className="flex-1 bg-transparent outline-none font-medium"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className={`text-sm font-medium ${textSec} mb-1 block`}>Location</label>
                                <div className="h-24 rounded-xl bg-gray-200 dark:bg-gray-800 relative overflow-hidden flex items-center justify-center group cursor-pointer">
                                    <img src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=600&q=80" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                                    <button className="relative z-10 bg-black text-white px-4 py-2 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg"><MapPinFilled size={14} /> Set Location</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Logistics */}
                    {wizardStep === 2 && (
                        <div className="space-y-6 animate-scale-in">
                            <div className={`${bgCard} rounded-2xl p-4 shadow-sm`}>
                                <div className="flex justify-between items-center mb-4">
                                    <span className="font-bold">Opening Hours</span>
                                    <span className="text-[10px] bg-[#00D68F]/10 text-[#00D68F] px-2 py-0.5 rounded font-bold">Mon - Fri</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className={`flex-1 p-3 rounded-xl ${inputBg} flex items-center justify-between cursor-pointer`}>
                                        <span className="font-medium">09:00</span>
                                        <Clock size={16} className={textSec} />
                                    </div>
                                    <span className={textSec}>-</span>
                                    <div className={`flex-1 p-3 rounded-xl ${inputBg} flex items-center justify-between cursor-pointer`}>
                                        <span className="font-medium">18:00</span>
                                        <Clock size={16} className={textSec} />
                                    </div>
                                </div>
                            </div>

                            <div className={`${bgCard} rounded-2xl p-4 shadow-sm`}>
                                <div className="flex items-center gap-4">
                                    <Truck size={24} className={textSec} />
                                    <div>
                                        <h3 className="font-bold">Delivery Options</h3>
                                        <p className={`text-xs ${textSec}`}>Configure your delivery zones and fees later in settings.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Payments */}
                    {wizardStep === 3 && (
                        <div className="space-y-4 animate-scale-in">
                            <p className={`text-sm ${textSec} mb-2`}>Connect your mobile money accounts to receive payments instantly.</p>
                            <div className={`${bgCard} rounded-2xl p-2 mb-8 shadow-sm`}>
                                <div className={`p-4 flex items-center justify-between border-b ${separator}`}>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#1E88E5] flex items-center justify-center text-white font-bold text-sm">W</div>
                                        <div>
                                            <div className="font-bold">Wave Money</div>
                                            <div className={`text-xs ${textSec}`}>Not connected</div>
                                        </div>
                                    </div>
                                    <button className="px-4 py-1.5 rounded-full bg-[#1C2624] dark:bg-gray-700 text-[#00D68F] text-xs font-bold">Connect</button>
                                </div>
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#E53935] flex items-center justify-center text-white font-bold text-sm">Q</div>
                                        <div>
                                            <div className="font-bold">Qmoney</div>
                                            <div className="text-xs text-[#00D68F] font-medium">• Connected</div>
                                        </div>
                                    </div>
                                    <button onClick={() => setQmoneyEnabled(!qmoneyEnabled)} className={`w-12 h-7 rounded-full transition-colors flex items-center px-0.5 ${qmoneyEnabled ? 'bg-[#00D68F] justify-end' : 'bg-gray-300 justify-start'}`}>
                                        <div className="w-6 h-6 bg-white rounded-full shadow-md"></div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Inventory */}
                    {wizardStep === 4 && (
                        <div className="space-y-4 animate-scale-in">
                            {inventory.length === 0 ? (
                                <div className="text-center py-8 opacity-60">
                                    <Package size={48} className="mx-auto mb-3" />
                                    <p className="font-medium">Your inventory is empty.</p>
                                    <p className="text-xs">Add your first product to get started.</p>
                                </div>
                            ) : (
                                <div className={`${bgCard} rounded-2xl p-2 shadow-sm space-y-2`}>
                                    {inventory.map((item, idx) => (
                                        <div key={idx} className={`flex items-center gap-3 p-3 ${idx < inventory.length - 1 ? `border-b ${separator}` : ''}`}>
                                            <img src={item.image} className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <div className="font-bold text-sm">{item.name}</div>
                                                </div>
                                                <div className="flex flex-wrap gap-1 mb-1">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded bg-[#00D68F]/20 text-[#00D68F] font-bold`}>{item.mainCategory}</span>
                                                    {/* Display tags in inventory list */}
                                                    {item.categories?.map(tag => (
                                                        <span key={tag} className={`text-[10px] px-1.5 py-0.5 rounded ${theme === 'light' ? 'bg-gray-100 text-gray-500' : 'bg-white/10 text-gray-400'} font-medium`}>{tag}</span>
                                                    ))}
                                                </div>
                                                <div className={`text-xs ${textSec}`}>Stock: {item.stock}</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold">D{item.price.toFixed(2)}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div
                                onClick={() => setView('add-product')}
                                className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-2xl p-6 flex items-center justify-center gap-3 cursor-pointer active:scale-[0.98] transition-transform hover:border-[#00D68F] hover:text-[#00D68F]"
                            >
                                <Plus size={20} />
                                <span className="font-bold text-sm">Add Product</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sticky Navigation Footer */}
                <div className={`p-4 ${theme === 'light' ? 'bg-white/90' : 'bg-[#1C1C1E]/90'} backdrop-blur-md border-t ${separator} pb-safe z-30`}>
                    <button
                        onClick={() => {
                            if (wizardStep < totalSteps) {
                                setWizardStep(prev => prev + 1);
                            } else {
                                triggerHaptic();
                                navigate('dashboard');
                                alert('Store Created!');
                            }
                        }}
                        className="w-full bg-[#00D68F] text-black py-4 rounded-full font-bold text-lg shadow-lg flex items-center justify-center gap-2"
                    >
                        {wizardStep < totalSteps ? (
                            <>Next Step <ArrowRight size={20} /></>
                        ) : (
                            <>Publish Store <Check size={20} /></>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    // Empty State (Intro)
    return (
        <div className={`h-full w-full ${bgMain} ${textMain} p-6 pt-safe flex flex-col items-center justify-center`}>
            <div className="w-32 h-32 bg-[#00D68F]/10 rounded-full flex items-center justify-center mb-6 animate-scale-in">
                <StoreIcon size={64} className="text-[#00D68F]" />
            </div>
            <h2 className="text-3xl font-bold mb-3">My Store</h2>
            <p className={`${textSec} text-center max-w-xs mb-10 leading-relaxed`}>
                Manage your business, add products, track orders, and reach more customers from one place.
            </p>
            <button
                onClick={() => { triggerHaptic(); setView('wizard'); setWizardStep(1); }}
                className="bg-black dark:bg-white text-white dark:text-black px-10 py-4 rounded-full font-bold text-lg shadow-xl active:scale-95 transition-transform"
            >
                Create Store
            </button>
            <BottomNav active="store" navigate={navigate} theme={theme} isScrolling={false} />
        </div>
    );
};