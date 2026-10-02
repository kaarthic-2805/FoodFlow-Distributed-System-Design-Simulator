import React, { useState, useEffect } from 'react';
import { ShoppingCart, Star, Clock, Database, HardDrive, Search, Filter, Plus, Minus, CheckCircle2, ChevronRight, RefreshCw, Zap, MapPin, Receipt, Utensils } from 'lucide-react';

interface MenuItem {
  id: string;
  restaurantId: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
}

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  address: string;
  rating: number;
  imageUrl: string;
  menuItems: MenuItem[];
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
}

interface FoodAppProps {
  onOrderPlaced: (orderId: string) => void;
  apiGatewayUrl: string;
}

export const FoodApp: React.FC<FoodAppProps> = ({ onOrderPlaced, apiGatewayUrl }) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataSource, setDataSource] = useState<'cache' | 'database'>('cache');
  const [activeInstance, setActiveInstance] = useState<string>('');
  const [selectedCuisine, setSelectedCuisine] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [deliveryAddress, setDeliveryAddress] = useState('742 Evergreen Terrace, Sector 4');
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [cdnStatus, setCdnStatus] = useState<any>(null);

  const fetchRestaurants = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiGatewayUrl}/api/restaurants`);
      const json = await res.json();
      if (json.data) {
        setRestaurants(json.data);
        setDataSource(json.source || 'database');
        setActiveInstance(json.instanceId || 'unknown');
        if (json.data.length > 0 && !selectedRestaurant) {
          setSelectedRestaurant(json.data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load restaurants', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, []);

  const getQuantityInCart = (itemId: string) => {
    const item = cart.find((c) => c.menuItem.id === itemId);
    return item ? item.quantity : 0;
  };

  const updateQuantity = (menuItem: MenuItem, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === menuItem.id);
      if (!existing) {
        if (delta > 0) return [...prev, { menuItem, quantity: delta }];
        return prev;
      }
      const newQty = existing.quantity + delta;
      if (newQty <= 0) {
        return prev.filter((c) => c.menuItem.id !== menuItem.id);
      }
      return prev.map((c) => (c.menuItem.id === menuItem.id ? { ...c, quantity: newQty } : c));
    });
  };

  const subtotal = cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  const deliveryFee = subtotal > 0 ? 2.99 : 0;
  const taxesAndFees = subtotal * 0.05;
  const grandTotal = subtotal + deliveryFee + taxesAndFees;

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsPlacingOrder(true);
    try {
      const restId = selectedRestaurant ? selectedRestaurant.id : cart[0].menuItem.restaurantId;
      const payload = {
        userId: 'usr-demo-001',
        restaurantId: restId,
        items: cart.map((i) => ({
          menuItemId: i.menuItem.id,
          name: i.menuItem.name,
          price: i.menuItem.price,
          quantity: i.quantity
        })),
        deliveryAddress
      };

      const res = await fetch(`${apiGatewayUrl}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (res.ok && json.data) {
        setCart([]);
        onOrderPlaced(json.data.id);
      } else {
        alert(`Order placement failed: ${json.error || 'Server error'}`);
      }
    } catch (err: any) {
      alert(`Error creating order: ${err.message}`);
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const testCdnFetch = async (region: 'us-east' | 'eu-central') => {
    const start = Date.now();
    try {
      const res = await fetch(`${apiGatewayUrl}/api/restaurants/cdn/assets/${region}/food-banner.jpg`);
      const json = await res.json();
      setCdnStatus({ ...json, clientLatency: Date.now() - start });
    } catch (e) {
      setCdnStatus({ error: 'CDN request failed' });
    }
  };

  // Filter restaurants by cuisine
  const filteredRestaurants = restaurants.filter((r) => {
    if (selectedCuisine !== 'ALL' && r.cuisine !== selectedCuisine) return false;
    return true;
  });

  // Collect menu items across selected restaurant or filtered items
  const currentMenuItems = (selectedRestaurant ? selectedRestaurant.menuItems : restaurants.flatMap(r => r.menuItems)) || [];
  
  const displayedItems = currentMenuItems.filter((item) => {
    if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return item.name.toLowerCase().includes(q) || item.description.toLowerCase().includes(q);
    }
    return true;
  });

  // Extract unique categories
  const allCategories = ['ALL', ...Array.from(new Set(restaurants.flatMap(r => r.menuItems.map(m => m.category))))];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* App Header & Banner */}
      <div className="relative overflow-hidden rounded-3xl p-8 bg-gradient-to-r from-indigo-900/50 via-purple-900/40 to-slate-950 border border-white/10 shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center space-x-1">
                <Utensils className="w-3.5 h-3.5" />
                <span>FoodFlow Customer Portal</span>
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Gateway Node: {activeInstance || 'LB Round-Robin'}
              </span>
            </div>
            <h1 className="text-3xl font-extrabold text-white tracking-tight">Order Food & Trigger Distributed Kafka Stream</h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              Select dishes, adjust quantities, and place an order. Watch your order travel live through API Gateway ➔ Microservices ➔ Redis Cache-Aside ➔ Kafka Topics ➔ Async Workers.
            </p>
          </div>

          <div className="flex items-center space-x-3 bg-slate-900/90 p-3.5 rounded-2xl border border-white/10 shadow-lg">
            {dataSource === 'cache' ? (
              <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs px-2">
                <HardDrive className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>[REDIS CACHE HIT]</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-amber-400 font-mono text-xs px-2">
                <Database className="w-4 h-4 text-amber-400 animate-bounce" />
                <span>[MYSQL / SQLITE MISS]</span>
              </div>
            )}
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const res = await fetch(`${apiGatewayUrl}/api/restaurants/external-sync`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: 'pasta' })
                  });
                  const json = await res.json();
                  alert(json.message || 'External dishes imported!');
                  fetchRestaurants();
                } catch (e) {
                  alert('External sync failed');
                } finally {
                  setLoading(false);
                }
              }}
              className="px-3 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center space-x-1.5 transition-all shadow-md"
              title="Fetch live dishes from external food API (TheMealDB)"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>Import External API Dishes</span>
            </button>
            <button
              onClick={fetchRestaurants}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all border border-white/5"
              title="Refresh Restaurant Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Search & Cuisine Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search dishes (e.g. Ramen, Pizza, Burger)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900/90 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
          />
        </div>

        {/* Cuisine Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 scrollbar-thin">
          <span className="text-xs font-semibold text-slate-400 mr-1 flex items-center space-x-1 shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Cuisine:</span>
          </span>
          {['ALL', 'Japanese', 'Italian', 'American', 'Healthy & Vegan'].map((cuisine) => (
            <button
              key={cuisine}
              onClick={() => setSelectedCuisine(cuisine)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 border ${
                selectedCuisine === cuisine
                  ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                  : 'bg-slate-900 text-slate-400 border-white/5 hover:text-white hover:bg-slate-800'
              }`}
            >
              {cuisine}
            </button>
          ))}
        </div>
      </div>

      {/* Main Workspace Layout: Left Content vs Right Bill Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Restaurant Selector Cards */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <span>Select Restaurant</span>
              <span className="text-xs text-indigo-400 font-mono font-normal">({filteredRestaurants.length} Available)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredRestaurants.map((rest) => {
                const isSelected = selectedRestaurant?.id === rest.id;
                return (
                  <div
                    key={rest.id}
                    onClick={() => setSelectedRestaurant(rest)}
                    className={`cursor-pointer p-4 rounded-2xl border transition-all flex items-center space-x-4 ${
                      isSelected
                        ? 'bg-indigo-950/40 border-indigo-500 text-white shadow-xl shadow-indigo-500/10'
                        : 'bg-slate-900/70 border-white/5 text-slate-400 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10">
                      <img src={rest.imageUrl} alt={rest.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-sm text-white truncate">{rest.name}</h3>
                        <div className="flex items-center space-x-1 text-amber-400 font-bold text-xs">
                          <Star className="w-3.5 h-3.5 fill-amber-400" />
                          <span>{rest.rating}</span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{rest.cuisine} • {rest.address}</div>
                      <div className="text-[11px] text-emerald-400 mt-1 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>20-30 min delivery</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center space-x-2 border-b border-white/10 pb-3 overflow-x-auto scrollbar-thin">
            {allCategories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shrink-0 ${
                  selectedCategory === cat
                    ? 'bg-slate-800 text-white border border-white/10'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {cat === 'ALL' ? 'All Items' : cat}
              </button>
            ))}
          </div>

          {/* Product Items Display Grid */}
          <div className="space-y-4">
            <h2 className="text-base font-bold text-white flex items-center space-x-2">
              <span>{selectedRestaurant ? `${selectedRestaurant.name} Menu` : 'All Available Items'}</span>
              <span className="text-xs font-mono text-slate-400">({displayedItems.length} dishes)</span>
            </h2>

            {displayedItems.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No items match your search or filter. Try clearing the search query.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {displayedItems.map((item) => {
                  const qty = getQuantityInCart(item.id);
                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-slate-900/90 border border-white/5 hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-4 group shadow-md"
                    >
                      <div className="flex items-start justify-between space-x-3">
                        <div>
                          <div className="text-xs font-mono text-indigo-400">{item.category}</div>
                          <h3 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                            {item.name}
                          </h3>
                          <p className="text-xs text-slate-400 mt-1 line-clamp-2">{item.description}</p>
                        </div>
                        <span className="text-base font-extrabold text-emerald-400 shrink-0 font-mono">
                          ${item.price.toFixed(2)}
                        </span>
                      </div>

                      {/* Interactive Quantity Controller */}
                      <div className="flex items-center justify-between border-t border-white/5 pt-3">
                        <span className="text-xs text-slate-400 font-mono">Quantity:</span>

                        {qty === 0 ? (
                          <button
                            onClick={() => updateQuantity(item, 1)}
                            className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs font-bold flex items-center space-x-1.5 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Item</span>
                          </button>
                        ) : (
                          <div className="flex items-center space-x-3 bg-indigo-950/60 p-1.5 rounded-xl border border-indigo-500/40">
                            <button
                              onClick={() => updateQuantity(item, -1)}
                              className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white flex items-center justify-center transition-colors"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-sm font-extrabold font-mono text-white px-1">{qty}</span>
                            <button
                              onClick={() => updateQuantity(item, 1)}
                              className="w-7 h-7 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center justify-center transition-colors shadow-md"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CDN Edge Cache Test Tool */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 border border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white">CDN Edge Latency Test</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => testCdnFetch('us-east')}
                  className="px-3 py-1.5 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
                >
                  US-East Edge (5ms)
                </button>
                <button
                  onClick={() => testCdnFetch('eu-central')}
                  className="px-3 py-1.5 rounded-xl text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 border border-white/10"
                >
                  EU-Central Edge (85ms)
                </button>
              </div>
            </div>

            {cdnStatus && (
              <div className="p-4 rounded-xl bg-slate-900 border border-white/5 font-mono text-xs space-y-1">
                <div className="text-emerald-400">
                  CDN Status: <span className="font-bold">{cdnStatus.cdnStatus}</span> ({cdnStatus.edgeRegion})
                </div>
                <div className="text-slate-400">Edge Latency: {cdnStatus.latencyMs}ms | Client Total: {cdnStatus.clientLatency}ms</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Detailed Itemized Order Bill & Checkout */}
        <div className="glass-panel p-6 rounded-3xl h-fit space-y-6 sticky top-24 border border-white/10 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div className="flex items-center space-x-2">
              <Receipt className="w-5 h-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white">Bill Summary</h2>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {cart.reduce((sum, i) => sum + i.quantity, 0)} Items
            </span>
          </div>

          {/* Customer Delivery Address Input */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>Delivery Address</span>
            </label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
            />
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm space-y-2">
              <ShoppingCart className="w-8 h-8 text-slate-600 mx-auto" />
              <div>Your cart is empty.</div>
              <div className="text-xs text-slate-600">Select dishes from the menu to start your order.</div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Itemized Cart List */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin">
                {cart.map(({ menuItem, quantity }) => (
                  <div key={menuItem.id} className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">{menuItem.name}</div>
                        <div className="text-xs text-slate-400 font-mono">
                          ${menuItem.price.toFixed(2)} × {quantity}
                        </div>
                      </div>
                      <span className="text-sm font-extrabold text-emerald-400 font-mono">
                        ${(menuItem.price * quantity).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-1 border-t border-white/5">
                      <button
                        onClick={() => updateQuantity(menuItem, -1)}
                        className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-bold font-mono px-2">{quantity}</span>
                      <button
                        onClick={() => updateQuantity(menuItem, 1)}
                        className="p-1 rounded bg-indigo-600 text-white"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Financial Breakdown */}
              <div className="border-t border-white/10 pt-4 space-y-2 font-mono text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Items Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Delivery Charge</span>
                  <span>${deliveryFee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Taxes & Service Fee (5%)</span>
                  <span>${taxesAndFees.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-extrabold text-white pt-3 border-t border-white/10">
                  <span>Grand Total</span>
                  <span className="text-lg text-emerald-400">${grandTotal.toFixed(2)}</span>
                </div>
              </div>

              {/* System Stream Note */}
              <div className="p-3 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-[11px] text-indigo-300 space-y-1">
                <div className="font-bold flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Distributed Order Stream</span>
                </div>
                <p className="text-slate-400">
                  Submitting produces a Kafka event to topic <code className="text-indigo-300 font-mono">foodflow.orders</code>.
                </p>
              </div>

              <button
                onClick={handleCheckout}
                disabled={isPlacingOrder}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm shadow-xl shadow-indigo-500/25 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
              >
                {isPlacingOrder ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Emitting Kafka Event...</span>
                  </>
                ) : (
                  <>
                    <span>Place Order (${grandTotal.toFixed(2)})</span>
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
