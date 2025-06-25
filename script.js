// Funções auxiliares
function formatarData(dataStr) {
  if (!dataStr) return "";
  const partes = dataStr.split("-");
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function gerarCodigoAleatorio(tamanho) {
  let codigo = "";
  const caracteres = "0123456789";
  for (let i = 0; i < tamanho; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
}

function corrigirNome(nome, lista) {
  const nomeNormalizado = nome.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return lista.find(exame =>
    exame.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(nomeNormalizado)
  );
}

// Variáveis globais
let exames = {};
let parceirosGuia = {};
let listaExames = [];

// Carregar planilhas
async function carregarPlanilhas() {
  const examesXLSX = await fetch("exames.xlsx").then(r => r.arrayBuffer());
  const parceirosXLSX = await fetch("parceiros.xlsx").then(r => r.arrayBuffer());

  const wbExames = XLSX.read(examesXLSX, { type: "buffer" });
  const wbParceiros = XLSX.read(parceirosXLSX, { type: "buffer" });

  const dadosExames = XLSX.utils.sheet_to_json(wbExames.Sheets[wbExames.SheetNames[0]]);
  const dadosParceiros = XLSX.utils.sheet_to_json(wbParceiros.Sheets[wbParceiros.SheetNames[0]]);

  dadosExames.forEach(linha => {
    const nome = linha.Exame;
    if (!exames[nome]) exames[nome] = [];
    exames[nome].push({ parceiro: linha.Parceiro, valor: parseFloat(linha.Valor) });
  });
  listaExames = Object.keys(exames);

  dadosParceiros.forEach(linha => {
    parceirosGuia[linha.Parceiro] = linha.Endereco;
  });

  popularParceirosGuia();
  montarFormularioOrcamento();
}

document.addEventListener("DOMContentLoaded", carregarPlanilhas);

// Navegação
document.querySelectorAll(".menu-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".tela").forEach(tela => {
      tela.classList.remove("active");
    });

    const target = btn.getAttribute("data-target");
    document.getElementById(target).classList.add("active");
  });
});

// Orçamento
let selecionadosOrcamento = [];

function montarFormularioOrcamento() {
  const input = document.getElementById("inputExame");
  const lista = document.getElementById("sugestoesExames");

  input.addEventListener("input", () => {
    const termo = input.value.trim().toLowerCase();
    lista.innerHTML = "";
    if (termo.length === 0) return;

    const sugeridos = listaExames.filter(exame =>
      exame.toLowerCase().includes(termo)
    ).slice(0, 5);

    sugeridos.forEach(s => {
      const li = document.createElement("li");
      li.textContent = s;
      li.addEventListener("click", () => {
        input.value = s;
        lista.innerHTML = "";
        buscarExamesOrc(s);
      });
      lista.appendChild(li);
    });
  });
}

function buscarExamesOrc(nomeExame) {
  const resultado = document.getElementById("resultadoOrc");
  resultado.innerHTML = "";
  const nome = corrigirNome(nomeExame, listaExames);
  if (!nome) {
    resultado.innerHTML = "<p>Exame não encontrado.</p>";
    return;
  }

  const parceiros = exames[nome];
  const card = document.createElement("div");
  card.className = "card-exame";
  card.innerHTML = `<h4>${nome}</h4>`;

  parceiros.forEach(item => {
    const linha = document.createElement("div");
    linha.className = "parceiro";
    linha.innerHTML = `
      <span>${item.parceiro}</span>
      <span>R$ ${item.valor.toFixed(2)}</span>
      <button class="btn-selecionar">Selecionar</button>
      <input type="number" value="${item.valor}" class="input-valor" />
    `;

    linha.querySelector(".btn-selecionar").addEventListener("click", () => {
      selecionadosOrcamento.push({ nome, parceiro: item.parceiro, valor: item.valor });
      atualizarResumoOrc();
    });

    linha.querySelector(".input-valor").addEventListener("change", e => {
      item.valor = parseFloat(e.target.value);
    });

    card.appendChild(linha);
  });

  resultado.appendChild(card);
}

function atualizarResumoOrc() {
  const lista = document.getElementById("listaSelecionadosOrc");
  const totalSpan = document.getElementById("totalOrc");
  lista.innerHTML = "";
  let total = 0;

  selecionadosOrcamento.forEach(item => {
    const li = document.createElement("li");
    li.textContent = `${item.nome} - ${item.parceiro}: R$ ${item.valor.toFixed(2)}`;
    lista.appendChild(li);
    total += item.valor;
  });

  totalSpan.textContent = total.toFixed(2);
  document.getElementById("btnDownloadOrc").disabled = selecionadosOrcamento.length === 0;
}

function baixarPDFOrc() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const img = new Image();
  img.src = "papel-timbrado.jpg";
  img.onload = () => {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.addImage(img, "JPEG", 0, 0, w, h);

    doc.setFont("Montserrat", "bold");
    doc.setFontSize(14);
    doc.text("Exames Incluídos neste Orçamento", w / 2, 193, { align: "center" });

    doc.setFont("Montserrat", "normal");
    doc.setFontSize(12);
    let y = 223;

    selecionadosOrcamento.forEach(item => {
      const texto = `Exame: ${item.nome} | Parceiro: ${item.parceiro} | R$ ${item.valor.toFixed(2)}`;
      doc.text(texto, 56.7, y);
      y += 20;
    });

    const total = selecionadosOrcamento.reduce((acc, cur) => acc + cur.valor, 0);
    doc.setFont("Montserrat", "bold");
    doc.text(`Total: R$ ${total.toFixed(2)}`, 56.7, y + 20);

    doc.save("orcamento-central.pdf");
  };
}

// Guia
function popularParceirosGuia() {
  const select = document.getElementById("selectParceiroGuia");
  for (const parceiro in parceirosGuia) {
    const opt = document.createElement("option");
    opt.value = parceiro;
    opt.textContent = parceiro;
    select.appendChild(opt);
  }
}

document.getElementById("add-procedimento").addEventListener("click", () => {
  const div = document.createElement("div");
  div.className = "procedimento-item";
  div.innerHTML = `
    <input type="text" class="nome-procedimento" placeholder="Procedimento" required />
    <input type="number" min="1" value="1" class="quantidade-procedimento" required />
    <button type="button" onclick="this.parentElement.remove()">Remover</button>
  `;
  document.getElementById("procedimentos-container").appendChild(div);
});

document.getElementById("form-guia").addEventListener("submit", e => {
  e.preventDefault();
  const nome = document.getElementById("nomePacienteGuia").value;
  const data = document.getElementById("dataAtendimentoGuia").value;
  const hora = document.getElementById("horaAtendimentoGuia").value;
  const parceiro = document.getElementById("selectParceiroGuia").value;

  const procedimentos = Array.from(document.querySelectorAll(".procedimento-item")).map(div => ({
    nome: div.querySelector(".nome-procedimento").value,
    quantidade: parseInt(div.querySelector(".quantidade-procedimento").value)
  }));

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const img = new Image();
  img.src = "papel-timbrado-guia.jpg";
  img.onload = () => {
    doc.addImage(img, "JPEG", 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight());

    let y = 193;
    doc.setFont("Montserrat", "normal");
    doc.setFontSize(12);
    doc.text(`Nome do paciente: ${nome}`, 56.7, y); y += 20;
    doc.text(`Data do atendimento: ${formatarData(data)}`, 56.7, y); y += 20;
    doc.text(`Horário: ${hora}`, 56.7, y); y += 20;

    doc.setFont("Montserrat", "bold");
    doc.text("Procedimentos:", 56.7, y); y += 20;
    doc.setFont("Montserrat", "normal");
    procedimentos.forEach(p => {
      doc.text(`${p.nome} - Quantidade: ${p.quantidade}`, 56.7, y); y += 18;
    });

    doc.setFont("Montserrat", "bold");
    doc.text(`Parceiro: ${parceiro}`, 56.7, y); y += 18;
    doc.setFont("Montserrat", "normal");
    doc.text(`Endereço: ${parceirosGuia[parceiro]}`, 56.7, y); y += 40;

    const infos = [
      "PARCEIRO ASSISTENCIAL",
      "Nome: Central de Exames",
      "Telefone: (81)9 9875--0905",
      "Endereço:",
      "ATENÇÃO:",
      "Documento de apresentação obrigatória",
      "Documento sem valor fiscal e não dedutível no imposto de renda.",
      "Retornos de consultas deverão ser agendados pelo usuário diretamente com a clínica."
    ];
    infos.forEach(linha => {
      doc.text(linha, 56.7, y);
      y += 16;
    });

    doc.save("guia-central.pdf");
  };
});

// Carteirinha
document.getElementById("form-carteirinha").addEventListener("submit", e => {
  e.preventDefault();
  const nome = document.getElementById("nomePacienteCarteirinha").value.toUpperCase();
  const data = document.getElementById("dataNascimentoCarteirinha").value;
  const mae = document.getElementById("nomeMaeCarteirinha").value.toUpperCase();
  gerarCarteirinha(nome, data, mae);
});

function gerarCarteirinha(nome, data, mae) {
  const canvas = document.getElementById("canvas-carteirinha");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  img.src = "carteirinha-fundo.png";
  img.onload = () => {
    canvas.width = 1445;
    canvas.height = 1000;
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = "#307ab9";
    ctx.font = "bold 37px 'LEMON MILK'";
    ctx.fillText(nome, 100, 393);
    ctx.fillText(formatarData(data), 100, 523);
    ctx.fillText(mae, 100, 665);
    ctx.font = "normal 32px 'LEMON MILK'";
    ctx.fillText(gerarCodigoAleatorio(8), 100, 874);

    const imgPreview = new Image();
    imgPreview.src = canvas.toDataURL("image/png");
    document.getElementById("carteirinha-preview").innerHTML = "";
    document.getElementById("carteirinha-preview").appendChild(imgPreview);

    const botao = document.createElement("button");
    botao.textContent = "📥 Baixar Carteirinha (PNG)";
    botao.addEventListener("click", () => {
      const a = document.createElement("a");
      a.href = imgPreview.src;
      a.download = "carteirinha-central.png";
      a.click();
    });
    document.getElementById("carteirinha-preview").appendChild(botao);
  };
}
