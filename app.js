// ===== แก้ตรงนี้: ใส่ address ที่ได้จากการ Deploy ใน Remix =====
const CONTRACT_ADDRESS = "0x3a3d53F6f28115f26Acefe6787Ef5016f2659fa4";

// ชื่อฟังก์ชันต้องตรงกับ contract (checkBlance สะกดแบบนี้)
const ABI = [
  "function deposit() public payable",
  "function withdraw(uint256 amount) public",
  "function checkBlance() public view returns (uint256 balance)",
  "event Deposit(address indexed owner, uint256 amount)",
  "event Withdraw(address indexed owner, uint256 amount)"
];

const SEPOLIA_CHAIN_ID = 11155111n;
const SEPOLIA_HEX = "0xaa36a7";
const EXPLORER = "https://sepolia.etherscan.io";
let provider, signer, contract;

const $ = (id) => document.getElementById(id);

function short(s, a = 6, b = 4) {
  return s.slice(0, a) + "..." + s.slice(-b);
}

// แสดงสถานะ (มีลิงก์ Etherscan ต่อท้ายได้)
function setStatus(msg, type = "", link = "") {
  const el = $("status");
  el.className = "status " + type;
  el.textContent = "สถานะ: " + msg;
  if (link) {
    const a = document.createElement("a");
    a.href = link;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = " ดูบน Etherscan ↗";
    el.appendChild(a);
  }
}

function errMsg(e) {
  return e.reason || e.shortMessage || e.message;
}

// แสดง contract address พร้อมลิงก์ไป Etherscan
function showContractLink() {
  const a = $("contractLink");
  a.textContent = short(CONTRACT_ADDRESS);
  a.href = EXPLORER + "/address/" + CONTRACT_ADDRESS;
}

// เพิ่มรายการธุรกรรมล่าสุด
function addHistory(type, amountEth, hash) {
  $("historyBox").classList.remove("hidden");
  const li = document.createElement("li");
  const isDep = type === "Deposit";

  const left = document.createElement("span");
  const t = document.createElement("span");
  t.className = "type " + (isDep ? "dep" : "wd");
  t.textContent = isDep ? "ฝาก" : "ถอน";
  const amt = document.createElement("span");
  amt.className = "amt";
  amt.textContent = amountEth + " ETH";
  left.append(t, amt);

  const a = document.createElement("a");
  a.href = EXPLORER + "/tx/" + hash;
  a.target = "_blank";
  a.rel = "noopener";
  a.textContent = short(hash, 8, 6) + " ↗";

  li.append(left, a);
  $("history").prepend(li);
}

// ขอให้ MetaMask สลับไปเครือข่าย Sepolia
async function switchToSepolia() {
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: SEPOLIA_HEX }]
  });
}

async function isSepolia() {
  const net = await provider.getNetwork();
  if (net.chainId !== SEPOLIA_CHAIN_ID) {
    setStatus("ไม่ใช่ Sepolia กรุณาสลับเครือข่ายใน MetaMask", "err");
    return false;
  }
  return true;
}

async function connectWallet() {
  if (!window.ethereum) {
    setStatus("ไม่พบ MetaMask กรุณาติดตั้งก่อน", "err");
    return;
  }
  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });

    const currentChain = await window.ethereum.request({ method: "eth_chainId" });
    if (currentChain !== SEPOLIA_HEX) {
      setStatus("กำลังขอสลับเป็น Sepolia... กรุณายืนยันใน MetaMask");
      await switchToSepolia();
    }

    provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    const net = await provider.getNetwork();
    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);

    const addr = await signer.getAddress();
    $("account").textContent = short(addr, 8, 6);
    $("network").textContent = net.name + " (chainId " + net.chainId + ")";
    $("btnConnect").textContent = "เชื่อมต่อแล้ว";

    if (net.chainId !== SEPOLIA_CHAIN_ID) {
      setStatus("ไม่ใช่ Sepolia กรุณาสลับเครือข่ายใน MetaMask", "err");
    } else {
      setStatus("เชื่อมต่อ MetaMask และ Smart Contract สำเร็จ", "ok");
      checkBalance(true);
    }
  } catch (e) {
    setStatus("เชื่อมต่อไม่สำเร็จ: " + errMsg(e), "err");
  }
}

function needConnect() {
  if (!contract) {
    setStatus("กรุณากดเชื่อมต่อ MetaMask ก่อน", "err");
    return true;
  }
  return false;
}

function getAmount() {
  const v = $("amount").value;
  if (!v || Number(v) <= 0) {
    setStatus("กรุณาใส่จำนวน ETH ที่มากกว่า 0", "err");
    return null;
  }
  return { text: v, wei: ethers.parseEther(v) };
}

function setBusy(busy) {
  ["btnDeposit", "btnWithdraw", "btnCheck"].forEach((id) => ($(id).disabled = busy));
}

async function deposit() {
  if (needConnect()) return;
  if (!(await isSepolia())) return;
  const amt = getAmount();
  if (amt === null) return;
  try {
    setBusy(true);
    setStatus("กำลังฝากเงิน... กรุณายืนยันใน MetaMask");
    const tx = await contract.deposit({ value: amt.wei });
    setStatus("รอการยืนยันบน blockchain...", "", EXPLORER + "/tx/" + tx.hash);
    await tx.wait();
    setStatus("ฝากเงินสำเร็จ!", "ok", EXPLORER + "/tx/" + tx.hash);
    addHistory("Deposit", amt.text, tx.hash);
    $("amount").value = "";
    await checkBalance(true);
  } catch (e) {
    setStatus("ฝากเงินไม่สำเร็จ: " + errMsg(e), "err");
  } finally {
    setBusy(false);
  }
}

async function withdraw() {
  if (needConnect()) return;
  if (!(await isSepolia())) return;
  const amt = getAmount();
  if (amt === null) return;
  try {
    setBusy(true);
    setStatus("กำลังถอนเงิน... กรุณายืนยันใน MetaMask");
    const tx = await contract.withdraw(amt.wei);
    setStatus("รอการยืนยันบน blockchain...", "", EXPLORER + "/tx/" + tx.hash);
    await tx.wait();
    setStatus("ถอนเงินสำเร็จ!", "ok", EXPLORER + "/tx/" + tx.hash);
    addHistory("Withdraw", amt.text, tx.hash);
    $("amount").value = "";
    await checkBalance(true);
  } catch (e) {
    setStatus("ถอนเงินไม่สำเร็จ: " + errMsg(e), "err");
  } finally {
    setBusy(false);
  }
}

async function checkBalance(keepStatus = false) {
  if (needConnect()) return;
  if (!(await isSepolia())) return;
  try {
    const bal = await contract.checkBlance();
    $("balance").textContent = ethers.formatEther(bal);
    if (keepStatus !== true) setStatus("ตรวจสอบยอดเงินสำเร็จ", "ok");
  } catch (e) {
    setStatus("เช็คยอดไม่สำเร็จ: " + errMsg(e), "err");
  }
}

showContractLink();

$("btnConnect").addEventListener("click", connectWallet);
$("btnDeposit").addEventListener("click", deposit);
$("btnWithdraw").addEventListener("click", withdraw);
$("btnCheck").addEventListener("click", () => checkBalance());

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => location.reload());
  window.ethereum.on("chainChanged", () => location.reload());

  // ถ้าเคยอนุญาตเว็บนี้แล้ว ให้เชื่อมต่ออัตโนมัติหลังรีโหลด
  window.ethereum.request({ method: "eth_accounts" }).then((accs) => {
    if (accs.length > 0) connectWallet();
  });
}