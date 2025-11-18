// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
export function activate(context: vscode.ExtensionContext) {

    console.log('Congratulations, your extension "poefilter" is now active!');

    // map rgba string -> decoration type so we can reuse and dispose
    const decorationTypes = new Map<string, vscode.TextEditorDecorationType>();

    // regex: match "Set...Color" followed by four decimal numbers separated by whitespace
    const colorRegex = /Set[^\n]*?Color\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/gi;

    function hexToRgba(hex: string): { rgba: string; opaque: string } {
        let h = hex.replace('#', '');
        if (h.length === 3) {
            h = h.split('').map(c => c + c).join('') + 'FF';
        } else if (h.length === 6) {
            h = h + 'FF';
        } else if (h.length === 8) {
            // already rrg gbbaa
        }
        const r = parseInt(h.slice(0, 2), 16);
        const g = parseInt(h.slice(2, 4), 16);
        const b = parseInt(h.slice(4, 6), 16);
        const a = parseInt(h.slice(6, 8), 16) / 255;
        const rgba = `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
        const opaque = `rgba(${r}, ${g}, ${b}, 1)`;
        return { rgba, opaque };
    }

    function updateDecorations(editor?: vscode.TextEditor) {
        if (!editor) return;
        const doc = editor.document;
        if (doc.languageId !== 'filter') return;

        const text = doc.getText();
        const found = new Map<string, vscode.DecorationOptions[]>();
        let m: RegExpExecArray | null;
        while ((m = colorRegex.exec(text)) !== null) {
            const match = m[0];
            const start = doc.positionAt(m.index);
            const end = doc.positionAt(m.index + match.length);

            // numeric RGBA from Set...Color capture groups (format: Set...Color R G B A)
            const r = Number(m[1]);
            const g = Number(m[2]);
            const b = Number(m[3]);
            let a = Number(m[4]);
            if (isNaN(r) || isNaN(g) || isNaN(b) || isNaN(a)) continue;

            // accept alpha in 0-1 or 0-255 form
            if (a > 1) a = a / 255;

            const rgba = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(3)})`;
            const opaque = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 1)`;

            const key = rgba;
            const hover = new vscode.MarkdownString();
            hover.appendCodeblock(match, 'text');

            // place a zero-length range at the end of the match so the square renders after the code
            const squarePos = new vscode.Range(end, end);
            const opt: vscode.DecorationOptions = { range: squarePos, hoverMessage: hover };

            if (!found.has(key)) found.set(key, []);
            found.get(key)!.push(opt);
        }

        // dispose decoration types that are not used anymore
        for (const [key, deco] of decorationTypes) {
            if (!found.has(key)) {
                deco.dispose();
                decorationTypes.delete(key);
            }
        }

        // create or update decorations (render a small square after each matched color)
        for (const [key, options] of found) {
            let decoType = decorationTypes.get(key);
            // derive an opaque border color for contrast
            const borderColor = key.includes('rgba') ? key.replace(/,\s*[^)]+\)$/, ', 1)') : key;
            if (!decoType) {
                decoType = vscode.window.createTextEditorDecorationType({
                    after: {
                        contentText: ' ',            // single space as attachment content
                        margin: '0 0 0 8px',         // gap between text and square
                        width: '12px',
                        height: '12px',
                        backgroundColor: key,
                        border: `1px solid ${borderColor}`                        
                    },
                    overviewRulerColor: borderColor,
                    overviewRulerLane: vscode.OverviewRulerLane.Right,
                });
                decorationTypes.set(key, decoType);
            }
            editor.setDecorations(decoType, options);
        }
    }

    // update when active editor changes
    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
        updateDecorations(editor);
    }));

    // update when document changes (only if the changed document is visible)
    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => {
        const editor = vscode.window.visibleTextEditors.find(ed => ed.document === e.document);
        if (editor) updateDecorations(editor);
    }));

    // update when a document is opened
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(doc => {
        const editor = vscode.window.visibleTextEditors.find(ed => ed.document === doc);
        if (editor) updateDecorations(editor);
    }));

    // run on activation for current editor
    if (vscode.window.activeTextEditor) {
        updateDecorations(vscode.window.activeTextEditor);
    }

    // dispose all decoration types on deactivate
    context.subscriptions.push({
        dispose() {
            for (const d of decorationTypes.values()) d.dispose();
            decorationTypes.clear();
        }
    });
    
}

// This method is called when your extension is deactivated
export function deactivate() {
    // nothing to do, disposables are added to context.subscriptions
}
