import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const supabase = SUPABASE_URL && SUPABASE_ANON_KEY ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const green = "#123b32", gold = "#e8b54a", ink = "#18241f", muted = "#65736d", paper = "#f4f6f3", line = "#dce4de";
const moneyOrCount = (v) => Number(v || 0).toLocaleString();

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("Home");
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [lastScan, setLastScan] = useState("");
  const [barcodeHandled, setBarcodeHandled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (alive) { setSession(data.session); setLoading(false); }
    }).catch(() => alive && setLoading(false));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (alive) setSession(nextSession);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!supabase || !session?.user) { setProfile(null); setProducts([]); return; }
    let alive = true;
    (async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (!alive) return;
      if (error || !data || data.active === false) {
        await supabase.auth.signOut();
        Alert.alert("Account unavailable", "Your Fuel the Fire account could not be verified. Ask your administrator for access.");
        return;
      }
      setProfile(data);
      await loadProducts(alive);
    })().catch((e) => { if (alive) Alert.alert("Could not load account", e.message || "Please try again."); });
    return () => { alive = false; };
  }, [session?.user?.id]);

  async function loadProducts(alive = true) {
    if (!supabase) return;
    setRefreshing(true);
    const { data, error } = await supabase.from("products").select("*").order("name");
    if (alive) {
      if (error) Alert.alert("Inventory unavailable", error.message);
      else setProducts(data || []);
      setRefreshing(false);
    }
  }

  async function signIn() {
    if (!supabase) return Alert.alert("App setup needed", "The app needs the Supabase public URL and publishable key in its local environment configuration.");
    if (!email.trim() || !password) return Alert.alert("Sign in", "Enter your email and password.");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (error) Alert.alert("Could not sign in", error.message);
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
    setPage("Home");
    setScanning(false);
  }

  const visibleProducts = useMemo(() => products.filter(p => [p.name, p.barcode, p.sku, p.packaging].some(v => String(v || "").toLowerCase().includes(search.toLowerCase()))), [products, search]);
  const isManager = ["admin", "manager"].includes(profile?.role);

  function handleBarcode(result) {
    if (barcodeHandled) return;
    setBarcodeHandled(true);
    const code = result?.data || "";
    setLastScan(code);
    setScanning(false);
    const match = products.find(p => String(p.barcode || "").trim() === String(code).trim());
    Alert.alert("Barcode scanned", match ? `Found: ${match.name}` : `Scanned ${code}. No matching product is currently in the loaded inventory.`, [{ text: "OK" }]);
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color={green} /><Text style={styles.muted}>Loading Fuel the Fire…</Text></SafeAreaView>;

  if (!session || !profile) return <SafeAreaView style={styles.authScreen}><StatusBar barStyle="light-content" /><View style={styles.brandRow}><View style={styles.brandIcon}><Text style={styles.flame}>🔥</Text></View><View><Text style={styles.brandTitle}>Fuel the Fire</Text><Text style={styles.brandSubtitle}>SCHOOL FOOD SERVICE</Text></View></View><View style={styles.authCard}><Text style={styles.eyebrow}>WELCOME BACK</Text><Text style={styles.hero}>Your inventory,{"\n"}in your hands.</Text><Text style={styles.authCopy}>Sign in with your existing Fuel the Fire account.</Text><Text style={styles.label}>Email</Text><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@school.org" style={styles.input} /><Text style={styles.label}>Password</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" placeholder="Your password" style={styles.input} onSubmitEditing={signIn} /><Pressable onPress={signIn} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Sign in securely</Text></Pressable><Text style={styles.footnote}>Your existing account permissions still apply. The app does not create demo products or sample inventory.</Text></View><Text style={styles.configNote}>{supabase ? "Connected to Fuel the Fire sign-in" : "App project created — local Supabase app configuration is required before sign-in."}</Text></SafeAreaView>;

  if (scanning) return <SafeAreaView style={styles.scannerScreen}><View style={styles.scannerHeader}><Pressable onPress={() => setScanning(false)}><Text style={styles.backText}>‹ Cancel</Text></Pressable><Text style={styles.scannerTitle}>Scan product barcode</Text></View>{!permission?.granted ? <View style={styles.center}><Text style={styles.heroSmall}>Camera permission is needed</Text><Pressable style={styles.primaryButton} onPress={requestPermission}><Text style={styles.primaryButtonText}>Allow camera</Text></Pressable></View> : <><CameraView style={styles.camera} facing="back" onBarcodeScanned={barcodeHandled ? undefined : handleBarcode} barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "itf14", "datamatrix", "qr"] }} /><Text style={styles.scanHelp}>Center the barcode in the frame. Scanning only looks up existing products; it will not add or change inventory.</Text><Pressable style={styles.secondaryButton} onPress={() => { setBarcodeHandled(false); setLastScan(""); }}><Text style={styles.secondaryText}>Scan again</Text></Pressable></>}</SafeAreaView>;

  const pages = ["Home", "Inventory", ...(isManager ? ["Products"] : []), "Reports"];
  return <SafeAreaView style={styles.appScreen}><StatusBar barStyle="light-content" /><View style={styles.topbar}><View style={styles.brandRowCompact}><View style={styles.brandIconSmall}><Text style={styles.flameSmall}>🔥</Text></View><View><Text style={styles.topBrand}>Fuel the Fire</Text><Text style={styles.topSub}>SCHOOL FOOD SERVICE</Text></View></View><Pressable onPress={signOut} style={styles.signOut}><Text style={styles.signOutText}>Sign out</Text></Pressable></View><ScrollView contentContainerStyle={styles.pageBody} keyboardShouldPersistTaps="handled">
    {page === "Home" && <><Text style={styles.eyebrow}>YOUR WORKSPACE</Text><Text style={styles.pageTitle}>Good to see you,{"\n"}{profile.full_name?.split(" ")[0] || "there"}.</Text><Text style={styles.subhead}>Keep your school food service moving.</Text><View style={styles.statsRow}><View style={styles.statCard}><Text style={styles.statValue}>{moneyOrCount(products.length)}</Text><Text style={styles.statLabel}>Products loaded</Text></View><View style={styles.statCard}><Text style={styles.statValue}>{moneyOrCount(products.reduce((n,p)=>n+Number(p.cases_on_hand||0),0))}</Text><Text style={styles.statLabel}>Cases on hand</Text></View></View><View style={styles.sectionHead}><Text style={styles.sectionTitle}>Quick actions</Text><Text style={styles.muted}>{profile.role}</Text></View><View style={styles.actionGrid}><Action title="View inventory" icon="▤" detail="Find products and stock" onPress={()=>setPage("Inventory")} /><Action title="Scan barcode" icon="▦" detail="Look up a product" onPress={()=>{setBarcodeHandled(false);setScanning(true);}} /><Action title="Products & lists" icon="＋" detail="Manager access" disabled={!isManager} onPress={()=>setPage("Products")} /><Action title="Reports" icon="▥" detail="Review available data" onPress={()=>setPage("Reports")} /></View><View style={styles.notice}><Text style={styles.noticeTitle}>Connected to your current account</Text><Text style={styles.noticeCopy}>The app reads existing inventory from the shared database. Scanning does not create products or change stock.</Text></View></>}
    {page === "Inventory" && <><Text style={styles.eyebrow}>STOCKROOM</Text><Text style={styles.pageTitle}>Inventory</Text><TextInput value={search} onChangeText={setSearch} placeholder="Search name, barcode, SKU…" style={styles.input} /><Pressable onPress={()=>loadProducts()} style={styles.refreshButton}><Text style={styles.secondaryText}>{refreshing ? "Refreshing…" : "Refresh inventory"}</Text></Pressable>{visibleProducts.length===0 ? <Empty title={products.length===0?"No products yet":"No matching products"} detail={products.length===0?"Your real inventory is empty. Add your actual products through your existing authorized workflow.":"Try another search."} /> : <FlatList scrollEnabled={false} data={visibleProducts} keyExtractor={p=>String(p.id)} renderItem={({item})=><View style={styles.productCard}><View style={styles.productTop}><Text style={styles.productName}>{item.name}</Text><Text style={styles.stockPill}>{moneyOrCount(item.cases_on_hand)} cases</Text></View><Text style={styles.productMeta}>{item.barcode ? "Barcode: "+item.barcode : "No barcode"}{item.sku ? "  •  SKU: "+item.sku : ""}</Text><Text style={styles.productMeta}>{item.packaging || item.package_size || "Packaging not listed"}</Text></View>} />}</>}
    {page === "Products" && <><Text style={styles.eyebrow}>MANAGER WORKSPACE</Text><Text style={styles.pageTitle}>Products & lists</Text><Text style={styles.subhead}>This first app build is read-only for product records. Use the existing website to create or edit real products while we finish and test the mobile workflows.</Text><View style={styles.notice}><Text style={styles.noticeTitle}>No demo inventory</Text><Text style={styles.noticeCopy}>No sample products, test stock movements, or sample purchases are created by this app.</Text></View><Pressable onPress={()=>loadProducts()} style={styles.primaryButton}><Text style={styles.primaryButtonText}>Refresh products</Text></Pressable></>}
    {page === "Reports" && <><Text style={styles.eyebrow}>OVERVIEW</Text><Text style={styles.pageTitle}>Reports</Text><View style={styles.statsRow}><View style={styles.statCard}><Text style={styles.statValue}>{moneyOrCount(products.length)}</Text><Text style={styles.statLabel}>Product records</Text></View><View style={styles.statCard}><Text style={styles.statValue}>{moneyOrCount(products.filter(p=>Number(p.cases_on_hand||0)===0&&Number(p.units_on_hand||0)===0).length)}</Text><Text style={styles.statLabel}>Zero-stock products</Text></View></View><Text style={styles.subhead}>This starter screen summarizes currently accessible product data. Detailed purchase, meal and stock-movement reports are not wired into the mobile app yet.</Text></>}
  </ScrollView><View style={styles.bottomNav}>{pages.map(p=><Pressable key={p} onPress={()=>setPage(p)} style={[styles.navItem,page===p&&styles.navActive]}><Text style={[styles.navLabel,page===p&&styles.navLabelActive]}>{p==="Home"?"⌂":p==="Inventory"?"▤":p==="Products"?"＋":"▥"}</Text><Text style={[styles.navText,page===p&&styles.navTextActive]}>{p}</Text></Pressable>)}</View></SafeAreaView>;
}

function Action({title,icon,detail,onPress,disabled}) { return <Pressable onPress={onPress} disabled={disabled} style={[styles.actionCard,disabled&&styles.disabled]}><Text style={styles.actionIcon}>{icon}</Text><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDetail}>{disabled?"Manager access only":detail}</Text></Pressable>; }
function Empty({title,detail}) { return <View style={styles.empty}><Text style={styles.emptyIcon}>▤</Text><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyCopy}>{detail}</Text></View>; }

const styles = StyleSheet.create({
 center:{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:paper,padding:24,gap:14}, muted:{color:muted,fontSize:13}, authScreen:{flex:1,backgroundColor:green,padding:24,justifyContent:"center"}, brandRow:{flexDirection:"row",alignItems:"center",gap:12,marginBottom:28}, brandIcon:{width:52,height:52,borderRadius:16,backgroundColor:"#ffffff1a",alignItems:"center",justifyContent:"center"}, flame:{fontSize:27}, brandTitle:{fontSize:24,fontWeight:"800",color:"#fff"},brandSubtitle:{fontSize:10,letterSpacing:2,color:"#d7e7de",marginTop:3,fontWeight:"700"},authCard:{backgroundColor:"#fff",borderRadius:24,padding:22},eyebrow:{fontSize:10,letterSpacing:2,fontWeight:"800",color:"#7a8e83",marginBottom:10},hero:{fontSize:31,lineHeight:37,fontWeight:"800",color:ink,marginBottom:10},authCopy:{fontSize:14,lineHeight:21,color:muted,marginBottom:20},label:{fontSize:12,fontWeight:"700",color:ink,marginBottom:7,marginTop:10},input:{backgroundColor:"#fff",borderWidth:1,borderColor:line,borderRadius:12,paddingHorizontal:14,paddingVertical:13,fontSize:15,color:ink,marginBottom:10},primaryButton:{backgroundColor:green,borderRadius:12,padding:15,alignItems:"center",justifyContent:"center",marginTop:10},primaryButtonText:{color:"#fff",fontWeight:"800",fontSize:14},footnote:{fontSize:11,lineHeight:17,color:muted,marginTop:16},configNote:{fontSize:11,color:"#d7e7de",textAlign:"center",marginTop:18},appScreen:{flex:1,backgroundColor:paper},topbar:{backgroundColor:green,paddingHorizontal:18,paddingVertical:14,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},brandRowCompact:{flexDirection:"row",alignItems:"center",gap:9},brandIconSmall:{width:35,height:35,borderRadius:11,backgroundColor:"#ffffff1a",alignItems:"center",justifyContent:"center"},flameSmall:{fontSize:18},topBrand:{color:"#fff",fontSize:16,fontWeight:"800"},topSub:{color:"#c5d8ce",fontSize:8,letterSpacing:1.5,marginTop:2},signOut:{borderColor:"#ffffff55",borderWidth:1,borderRadius:9,paddingHorizontal:11,paddingVertical:7},signOutText:{color:"#fff",fontSize:11,fontWeight:"700"},pageBody:{padding:20,paddingBottom:26},pageTitle:{fontSize:29,fontWeight:"800",lineHeight:34,color:ink,marginBottom:8},subhead:{fontSize:14,lineHeight:21,color:muted,marginBottom:22},statsRow:{flexDirection:"row",gap:12,marginBottom:25},statCard:{flex:1,backgroundColor:"#fff",borderColor:line,borderWidth:1,borderRadius:16,padding:16},statValue:{fontSize:26,fontWeight:"800",color:green},statLabel:{fontSize:11,color:muted,marginTop:5},sectionHead:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:12},sectionTitle:{fontSize:17,fontWeight:"800",color:ink},actionGrid:{flexDirection:"row",flexWrap:"wrap",gap:12},actionCard:{width:"47%",flexGrow:1,backgroundColor:"#fff",borderWidth:1,borderColor:line,borderRadius:16,padding:15,minHeight:125},actionIcon:{fontSize:23,color:green,marginBottom:13},actionTitle:{fontSize:13,fontWeight:"800",color:ink},actionDetail:{fontSize:11,lineHeight:16,color:muted,marginTop:5},disabled:{opacity:.45},notice:{backgroundColor:"#e7eee8",borderRadius:14,padding:15,marginTop:20},noticeTitle:{fontSize:13,fontWeight:"800",color:green,marginBottom:5},noticeCopy:{fontSize:12,lineHeight:18,color:"#405a4e"},bottomNav:{flexDirection:"row",backgroundColor:"#fff",borderTopColor:line,borderTopWidth:1,paddingTop:7,paddingBottom:Platform.OS==="ios"?5:8},navItem:{flex:1,alignItems:"center",paddingVertical:7,gap:3},navActive:{backgroundColor:"#e8efe9",borderRadius:10,marginHorizontal:4},navLabel:{fontSize:20,color:"#819087"},navLabelActive:{color:green},navText:{fontSize:10,color:"#819087",fontWeight:"600"},navTextActive:{color:green,fontWeight:"800"},productCard:{backgroundColor:"#fff",borderWidth:1,borderColor:line,borderRadius:14,padding:15,marginBottom:10},productTop:{flexDirection:"row",justifyContent:"space-between",gap:8,alignItems:"flex-start"},productName:{flex:1,fontSize:14,fontWeight:"800",color:ink},stockPill:{fontSize:10,fontWeight:"800",color:green,backgroundColor:"#e7eee8",paddingHorizontal:8,paddingVertical:5,borderRadius:7},productMeta:{fontSize:11,color:muted,marginTop:6},refreshButton:{alignSelf:"flex-start",borderWidth:1,borderColor:line,borderRadius:10,padding:10,marginBottom:14},secondaryText:{fontSize:12,color:green,fontWeight:"800"},empty:{alignItems:"center",paddingVertical:44,paddingHorizontal:20},emptyIcon:{fontSize:32,color:"#8b9b90",marginBottom:12},emptyTitle:{fontSize:16,fontWeight:"800",color:ink},emptyCopy:{fontSize:12,lineHeight:18,color:muted,textAlign:"center",marginTop:7},scannerScreen:{flex:1,backgroundColor:"#101713",padding:18},scannerHeader:{flexDirection:"row",alignItems:"center",gap:20,marginBottom:20},backText:{color:gold,fontSize:15,fontWeight:"700"},scannerTitle:{fontSize:17,fontWeight:"800",color:"#fff"},camera:{flex:1,borderRadius:18,overflow:"hidden"},scanHelp:{fontSize:13,lineHeight:20,color:"#e0e9e3",textAlign:"center",paddingVertical:17},secondaryButton:{borderWidth:1,borderColor:"#ffffff66",borderRadius:12,padding:13,alignItems:"center",marginBottom:10},heroSmall:{fontSize:18,color:ink,fontWeight:"800"}
});
