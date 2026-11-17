#!/usr/bin/env python3
from __future__ import annotations

import os
import json
import shlex
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable, Sequence

HEX = {
    "text": "#2c3e50",
    "separator": "#ffd166",
    "section_main": "#ef476f",
    "item_main": "#ff8a5c",
    "section_secondary": "#06d6a0",
    "item_secondary": "#118ab2",
    "number": "#7209b7",
    "prompt": "#4361ee",
    "success": "#06d6a0",
    "warning": "#ffd166",
    "error": "#ef476f",
    "muted": "#6c757d",
}

ROOT = Path(__file__).resolve().parent
PDF_WORKFLOW = ROOT / "workflows" / "pdf-to-epub"
EPUB_WORKFLOW = ROOT / "workflows" / "epub-structuring"
MARKDOWN_WORKFLOW = ROOT / "workflows" / "markdown-to-epub"
MARKDOWN_STATE = MARKDOWN_WORKFLOW / "state" / "last-used.json"


def supports_color() -> bool:
    return (
        os.environ.get("NO_COLOR") is None
        and sys.stdout.isatty()
        and os.environ.get("TERM", "") != "dumb"
    )


USE_COLOR = supports_color()


def ansi(hex_color: str, text: object, bold: bool = False) -> str:
    if not USE_COLOR:
        return str(text)

    value = hex_color.lstrip("#")
    if len(value) != 6:
        return str(text)

    r = int(value[0:2], 16)
    g = int(value[2:4], 16)
    b = int(value[4:6], 16)

    prefix = "1;" if bold else ""
    return f"\033[{prefix}38;2;{r};{g};{b}m{text}\033[0m"


def color(key: str, text: object, bold: bool = False) -> str:
    return ansi(HEX[key], text, bold=bold)


@dataclass(frozen=True)
class MenuItem:
    number: int
    label: str
    description: str
    action: Callable[[], None]
    color_key: str


@dataclass(frozen=True)
class MenuSection:
    title: str
    items: tuple[MenuItem, ...]
    color_key: str


def show_success(message: str) -> None:
    print(color("success", message, bold=True))


def show_warning(message: str) -> None:
    print(color("warning", message, bold=True))


def show_error(message: str) -> None:
    print(color("error", message, bold=True))


def print_header(title: str = "MENU PRINCIPAL") -> None:
    print()
    print(color("number", title, bold=True))
    print(color("separator", "━" * 50))


def print_quick_guide() -> None:
    print(color("section_main", "● ORIENTAÇÕES RÁPIDAS", bold=True))
    print(color("muted", "PDF: coloque o arquivo em workflows/pdf-to-epub/input/ e escolha 1."))
    print(color("muted", "Markdown: escolha 5 para selecionar uma pasta de capítulos."))
    print(color("muted", "O menu lembra os dados do último livro convertido."))
    print(color("muted", "Escolha 4 para ver os EPUBs gerados."))
    print()


def print_option(number: int, label: str, description: str = "", color_key: str = "text") -> None:
    label_text = f"{label:<22}"
    description_text = f" {description}" if description else ""
    print(f"  {color('number', str(number) + '.', bold=True)} {color(color_key, label_text)}{description_text}")


def ask_number(prompt: str, valid: Iterable[int] | None = None) -> int:
    valid_set = set(valid) if valid is not None else None

    while True:
        raw = input(color("prompt", prompt, bold=True)).strip()

        try:
            choice = int(raw)
        except ValueError:
            show_error("Opção inválida.")
            continue

        if valid_set is not None and choice not in valid_set:
            show_error("Opção inválida.")
            continue

        return choice


def run_command(command: list[str], cwd: Path, description: str, env: dict[str, str] | None = None) -> bool:
    print()
    print(color("muted", f"{description}...", bold=True))
    try:
        result = subprocess.run(command, cwd=str(cwd), text=True, env=env)
    except FileNotFoundError:
        show_error(f"Comando não encontrado: {command[0]}")
        return False

    if result.returncode != 0:
        show_error(f"Falha em: {description}")
        return False

    show_success(f"Concluído: {description}")
    return True


def list_pdfs_for_selection() -> list[Path]:
    input_dir = PDF_WORKFLOW / "input"
    input_dir.mkdir(parents=True, exist_ok=True)
    pdf_files = sorted(input_dir.glob("*.pdf"))
    if not pdf_files:
        show_error(f"Nenhum PDF encontrado em: {input_dir}")
        show_warning("Coloque um ou mais arquivos .pdf nessa pasta e tente novamente.")
        return []

    print(color("section_secondary", "● PDFs disponíveis na pasta", bold=True))
    for index, pdf in enumerate(pdf_files, start=1):
        print(f"  [{index}] {pdf.name}")
    print()
    return pdf_files


def select_pdf_from_list() -> Path | None:
    pdf_files = list_pdfs_for_selection()
    if not pdf_files:
        return None

    while True:
        choice = ask_number("Selecione o PDF para converter › ", set(range(1, len(pdf_files) + 1)))
        selected = pdf_files[choice - 1]
        print(color("warning", f"Você selecionou: {selected.name}", bold=True))
        confirm = input(color("prompt", "Confirmar esta seleção? [s/N] › ", bold=True)).strip().lower()
        if confirm in {"s", "sim", "y", "yes"}:
            return selected
        print(color("muted", "Seleção cancelada. Escolha novamente."))


def restore_pdf_state(input_dir: Path, original_files: dict[str, bytes]) -> None:
    for pdf_path in list(input_dir.glob("*.pdf")):
        if pdf_path.name not in original_files:
            pdf_path.unlink()

    for name, content in original_files.items():
        target = input_dir / name
        if target.exists():
            target.unlink()
        target.write_bytes(content)


def prepare_single_pdf_for_workflow(selected_pdf: Path) -> tuple[Path, Path, dict[str, bytes]]:
    input_dir = PDF_WORKFLOW / "input"
    input_dir.mkdir(parents=True, exist_ok=True)

    original_files = {
        pdf_path.name: pdf_path.read_bytes()
        for pdf_path in sorted(input_dir.glob("*.pdf"))
    }

    backup_dir = Path(tempfile.mkdtemp(prefix="menu-pdf-backup-"))

    for candidate in sorted(input_dir.glob("*.pdf")):
        if candidate.name == selected_pdf.name:
            continue
        backup_target = backup_dir / candidate.name
        shutil.move(str(candidate), str(backup_target))
        print(color("muted", f"PDF temporariamente movido para backup: {candidate.name}"))

    target = input_dir / selected_pdf.name
    if selected_pdf != target:
        if target.exists():
            target.unlink()
        shutil.copy2(str(selected_pdf), str(target))
        print(color("muted", f"Arquivo preparado em: {target}"))

    return target, backup_dir, original_files


def ask_output_mode_for_epub(base_name: str) -> str:
    output_dir = PDF_WORKFLOW / "output"
    default_epub = output_dir / f"{base_name}.epub"
    if not default_epub.exists():
        return "new"

    print(color("warning", f"Já existe um EPUB com o nome base: {default_epub.name}", bold=True))
    print(color("muted", "Escolha o que fazer antes de continuar:"))
    print(color("muted", "  [1] Sobrescrever o arquivo existente"))
    print(color("muted", "  [2] Criar um novo EPUB com data/hora"))
    print(color("muted", "  [3] Cancelar"))

    while True:
        choice = ask_number("Opção › ", {1, 2, 3})
        if choice == 1:
            return "overwrite"
        if choice == 2:
            return "new"
        print(color("muted", "Operação cancelada."))
        return "cancel"


def action_convert_pdf_to_epub() -> None:
    selected_pdf = select_pdf_from_list()
    if not selected_pdf:
        return

    workflow_dir = PDF_WORKFLOW
    if not (workflow_dir / "package.json").exists():
        show_error(f"Workflow não encontrado: {workflow_dir}")
        return

    base_name = selected_pdf.stem
    output_mode = ask_output_mode_for_epub(base_name)
    if output_mode == "cancel":
        return

    print(color("success", f"Iniciando conversão de: {selected_pdf.name}", bold=True))

    input_dir = workflow_dir / "input"
    backup_dir = None
    original_files = {}
    prepared_pdf = None

    try:
        prepared_pdf, backup_dir, original_files = prepare_single_pdf_for_workflow(selected_pdf)

        if not (workflow_dir / "node_modules").exists():
            if not run_command(["npm", "install"], workflow_dir, "Instalando dependências do workflow PDF -> EPUB"):
                return

        print(color("muted", f"Executando workflow com: {prepared_pdf.name}"))
        env = os.environ.copy()
        env["EPUB_OUTPUT_MODE"] = output_mode

        if not run_command(["npm", "start"], workflow_dir, "Convertindo PDF para EPUB", env=env):
            return

        output_dir = workflow_dir / "output"
        epub_files = sorted(output_dir.glob("*.epub"))
        if epub_files:
            show_success(f"Arquivo EPUB gerado em: {epub_files[-1]}")
        else:
            show_warning("O workflow terminou, mas nenhum .epub foi encontrado em output/.")
    finally:
        try:
            if input_dir.exists():
                restore_pdf_state(input_dir, original_files)
            if backup_dir is not None and backup_dir.exists():
                for item in sorted(backup_dir.iterdir()):
                    if item.name not in original_files:
                        item.unlink()
                shutil.rmtree(backup_dir, ignore_errors=True)
        except OSError as exc:
            show_error(f"Não foi possível restaurar o estado original do diretório de PDFs: {exc}")


def action_structure_epub() -> None:
    input_dir = EPUB_WORKFLOW / "input"
    input_dir.mkdir(parents=True, exist_ok=True)
    epub_files = sorted(input_dir.glob("*.epub"))
    if not epub_files:
        show_error(f"Nenhum EPUB encontrado em: {input_dir}")
        show_warning("Coloque um arquivo .epub nessa pasta para estruturar/validar.")
        return

    workflow_dir = EPUB_WORKFLOW
    if not (workflow_dir / "package.json").exists():
        show_error(f"Workflow não encontrado: {workflow_dir}")
        return

    if not (workflow_dir / "node_modules").exists():
        if not run_command(["npm", "install"], workflow_dir, "Instalando dependências do workflow de estruturação EPUB"):
            return

    if not run_command(["npm", "start"], workflow_dir, "Estruturando e validando EPUB"):
        return

    output_dir = workflow_dir / "output"
    show_success(f"Saída gerada em: {output_dir}")


def action_convert_markdown_to_epub() -> None:
    saved = load_markdown_settings()
    source = select_markdown_directory(saved.get("source", ""))
    if source is None:
        return
    if saved.get("source") != str(source):
        saved = {}
    settings = {
        "source": str(source),
        "title": saved.get("title", ""),
        "author": saved.get("author", ""),
        "language": saved.get("language", "pt-BR"),
        "cover": saved.get("cover", "") or find_markdown_cover(),
        "output": saved.get("output", ""),
    }
    if not settings["title"] or not settings["author"]:
        settings = edit_markdown_settings(settings)
        if settings is None:
            return

    while True:
        output = markdown_output_path(settings["output"], settings["title"], settings["author"])
        print(color("section_secondary", "● Livro Markdown", bold=True))
        print(f"  Capítulos: {source}")
        print(f"  Título: {settings['title']}")
        print(f"  Autor: {settings['author']}")
        print(f"  Idioma: {settings['language']}")
        print(f"  Capa: {settings['cover'] or 'sem capa'}")
        print(f"  Saída: {output}")
        choice = input(color("prompt", "[Enter] Gerar  [e] Editar  [c] Cancelar › ", bold=True)).strip().lower()
        if choice == "e":
            settings = edit_markdown_settings(settings)
            if settings is None:
                return
            continue
        if choice in {"c", "cancelar"}:
            return
        if choice == "":
            break
        show_error("Opção inválida.")

    if output.exists():
        show_warning(f"Já existe: {output.name}")
        overwrite = input(color("prompt", "[s] Sobrescrever  [n] Criar outro nome  [Enter] Cancelar › ", bold=True)).strip().lower()
        if overwrite == "n":
            settings["output"] = input(color("prompt", "Novo nome do EPUB › ", bold=True)).strip()
            output = markdown_output_path(settings["output"], settings["title"], settings["author"])
            if output.exists():
                show_error(f"O arquivo já existe: {output}")
                return
        elif overwrite not in {"s", "sim"}:
            return

    command = ["npm", "run", "build:markdown-epub", "--", "--input", str(source), "--title", settings["title"], "--author", settings["author"], "--language", settings["language"], "--output", str(output)]
    if settings["cover"]:
        command += ["--cover", str(Path(settings["cover"]).expanduser())]
    if run_command(command, ROOT, "Convertendo Markdown para EPUB e validando com EPUBCheck"):
        settings["output"] = str(output)
        MARKDOWN_STATE.parent.mkdir(parents=True, exist_ok=True)
        MARKDOWN_STATE.write_text(json.dumps(settings, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        show_success(f"Arquivo EPUB gerado em: {output}")


def load_markdown_settings() -> dict[str, str]:
    try:
        return json.loads(MARKDOWN_STATE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def markdown_directories(last_source: str) -> list[Path]:
    roots = [MARKDOWN_WORKFLOW / "input", ROOT.parent / "temporario"]
    candidates = [Path(last_source).expanduser()] if last_source else []
    for root in roots:
        candidates.append(root)
        if root.is_dir():
            candidates.extend(item for item in root.iterdir() if item.is_dir())
    return list(dict.fromkeys(item.resolve() for item in candidates if item.is_dir() and next(item.glob("capitulo_*_traducao_*.md"), None)))


def select_markdown_directory(last_source: str) -> Path | None:
    directories = markdown_directories(last_source)
    if len(directories) == 1:
        print(color("success", f"Capítulos encontrados em: {directories[0]}"))
        return directories[0]
    if directories:
        print(color("section_secondary", "● Pastas de capítulos", bold=True))
        for index, directory in enumerate(directories, 1):
            print(f"  [{index}] {directory}")
    print("  [0] Informar outra pasta")
    choice = ask_number("Selecione a pasta › ", range(len(directories) + 1))
    if choice:
        return directories[choice - 1]
    raw = input(color("prompt", "Caminho da pasta › ", bold=True)).strip()
    source = Path(raw).expanduser().resolve() if raw else None
    if source is None or not source.is_dir() or not next(source.glob("capitulo_*_traducao_*.md"), None):
        show_error("Pasta sem capítulos Markdown reconhecidos.")
        return None
    return source


def find_markdown_cover() -> str:
    cover_dir = MARKDOWN_WORKFLOW / "input" / "img"
    images = sorted(item for item in cover_dir.glob("*") if item.suffix.lower() in {".jpg", ".jpeg", ".png"})
    return str(images[0]) if len(images) == 1 else ""


def markdown_output_path(raw: str, title: str, author: str) -> Path:
    if raw:
        candidate = Path(raw).expanduser()
        if candidate.parent == Path("."):
            candidate = MARKDOWN_WORKFLOW / "output" / candidate
        elif not candidate.is_absolute():
            candidate = ROOT / candidate
    else:
        name = f"{title} - {author}".strip(" -")
        name = "".join("_" if char in '/\\:*?\"<>|' else char for char in name)
        candidate = MARKDOWN_WORKFLOW / "output" / name
    if not candidate.suffix:
        candidate = candidate.with_suffix(".epub")
    return candidate.resolve()


def edit_markdown_settings(settings: dict[str, str]) -> dict[str, str] | None:
    print(color("muted", "Enter mantém o valor exibido; use - para retirar a capa."))
    for key, label in (("title", "Título"), ("author", "Autor"), ("language", "Idioma"), ("cover", "Capa JPG/PNG"), ("output", "Nome ou caminho de saída")):
        current = settings[key]
        value = input(color("prompt", f"{label} [{current or 'automático'}] › ", bold=True)).strip()
        if value == "-" and key == "cover":
            settings[key] = ""
        elif value:
            settings[key] = str(Path(value).expanduser()) if key == "cover" else value
    if not settings["title"] or not settings["author"]:
        show_error("Título e autor são obrigatórios.")
        return None
    if settings["cover"] and not Path(settings["cover"]).expanduser().is_file():
        show_error(f"Capa inexistente: {settings['cover']}")
        return None
    if markdown_output_path(settings["output"], settings["title"], settings["author"]).suffix.lower() != ".epub":
        show_error("A saída deve ser um arquivo .epub.")
        return None
    return settings


def action_run_salt_society_epub_legacy() -> None:
    script = ROOT / "src" / "legacy" / "Gera_Epub2.js"
    if not script.exists():
        show_error(f"Script não encontrado: {script}")
        return

    print(color("success", "Executando geração do EPUB Salt Society via script legado...", bold=True))
    if not run_command(["node", str(script)], ROOT, "Gerando EPUB Salt Society"):
        return

    epub_file = ROOT / "salt-society.epub"
    if epub_file.exists():
        show_success(f"Arquivo final disponível em: {epub_file}")
    else:
        show_warning("O script terminou sem encontrar o arquivo salt-society.epub no diretório raiz.")


def action_list_outputs() -> None:
    sections = [
        ("PDF -> EPUB", PDF_WORKFLOW / "output"),
        ("EPUB estruturado", EPUB_WORKFLOW / "output"),
        ("Markdown -> EPUB", MARKDOWN_WORKFLOW / "output"),
    ]

    for label, directory in sections:
        print()
        print(color("section_secondary", f"● {label}", bold=True))
        if directory.exists():
            files = sorted(directory.iterdir())
            if files:
                for item in files:
                    print(f"  - {item.name}")
            else:
                print(color("muted", "  Nenhum arquivo encontrado."))
        else:
            print(color("muted", "  Diretório ainda não existe."))


def build_menu() -> tuple[MenuSection, ...]:
    return (
        MenuSection(
            "CONVERSÃO",
            (
                MenuItem(
                    1,
                    "PDF para EPUB",
                    "Converte um PDF em EPUB estruturado",
                    action_convert_pdf_to_epub,
                    "item_main",
                ),
                MenuItem(
                    2,
                    "Estruturar EPUB",
                    "Ajusta e valida um EPUB já existente",
                    action_structure_epub,
                    "item_main",
                ),
                MenuItem(
                    5,
                    "Markdown para EPUB",
                    "Converte capítulos Markdown e valida o EPUB",
                    action_convert_markdown_to_epub,
                    "item_main",
                ),
            ),
            "section_main",
        ),
        MenuSection(
            "UTILITÁRIOS",
            (
                MenuItem(
                    3,
                    "Gerar EPUB Salt Society",
                    "Executa o script legado para gerar o EPUB da obra",
                    action_run_salt_society_epub_legacy,
                    "item_secondary",
                ),
                MenuItem(
                    4,
                    "Ver saídas",
                    "Mostra arquivos gerados nas pastas de saída",
                    action_list_outputs,
                    "item_secondary",
                ),
            ),
            "section_secondary",
        ),
    )


def print_main_menu(sections: Sequence[MenuSection]) -> None:
    print_header()
    print()
    print_quick_guide()
    print(color("separator", "━" * 50))
    print()

    for section in sections:
        print(color(section.color_key, f"● {section.title}", bold=True))
        print()

        for item in section.items:
            print_option(item.number, item.label, item.description, item.color_key)
            print()

        print()

    print(color("separator", "━" * 50))
    print(f"  {color('number', '0.', bold=True)} {color('text', 'Sair')}")
    print()


def main() -> None:
    sections = build_menu()
    actions = {item.number: item.action for section in sections for item in section.items}
    valid_options = set(actions) | {0}

    while True:
        print_main_menu(sections)
        choice = ask_number("Selecione uma opção › ", valid_options)

        if choice == 0:
            show_success("Até logo.")
            return

        actions[choice]()


if __name__ == "__main__":
    main()
