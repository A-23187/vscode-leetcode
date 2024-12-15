import * as fse from "fs-extra";
import * as path from "path";
import { WorkspaceConfiguration } from "vscode";
import { executeCommand } from "./cpUtils";
import { getNodeIdFromFile } from "./problemUtils";
import { getWorkspaceConfiguration, getWorkspaceFolder } from "./settingUtils";
import { langExt } from "../shared";

export function getMoonbitFolder(): string {
    const leetCodeConfig: WorkspaceConfiguration = getWorkspaceConfiguration();
    return path.join(getWorkspaceFolder(),
        leetCodeConfig.get<string>("filePath.moonbit.folder", leetCodeConfig.get<string>("filePath.default.folder", "")));
}

export function getMoonbitExt(): string {
    return langExt.get("moonbit") || ".mbt";
}

export function isMoonbitFile(filePath: string, language: string | null): boolean {
    return filePath.startsWith(getMoonbitFolder()) && filePath.endsWith(`.${getMoonbitExt()}`)
        && (language == null || language === "moonbit");
}

export async function writeMoonbitModuleJson(): Promise<void> {
    const modJsonPath: string = path.join(getMoonbitFolder(), "moon.mod.json");
    if (await fse.pathExists(modJsonPath)) {
        return;
    }
    await fse.createFile(modJsonPath);
    await fse.writeFile(modJsonPath, `{"name":"moonbit-leetcode","source":"."}`);
}

export async function genMoonbitCodeTemplateAndWrite(jsCodeTemplate: string, moonbitFilePath: string): Promise<void> {
    const functionReg: RegExp = /^\s*var\s+([^\s]+)\s*=\s*function\s*\((.*)\)/;
    let functionName: string = "functionName";
    let functionParam: string = "";
    const lines: string[] = [];
    for (const line of jsCodeTemplate.split("\n")) {
        const match: RegExpMatchArray | null = line.match(functionReg);
        if (match && match.length === 3) {
            functionName = match[1];
            functionParam = match[2];
        }
        if (line && line.indexOf("@lc code=end") < 0) {
            lines.push(`// ${line}`);
        }
    }
    // TODO support functionParam with type and return type
    lines.push(`pub fn ${functionName}(${functionParam}) -> Unit {\n}\n// @lc code=end\n`);
    await writeMoonbitModuleJson();
    await fse.writeFile(moonbitFilePath, lines.join("\n"));
    await fse.writeFile(path.join(path.dirname(moonbitFilePath), "moon.pkg.json"),
        `{"is-main":false,"link":{"js":{"exports":["${functionName}"],"format":"iife"}}}`);
}

export async function moonbitBuild(moonbitFilePath: string): Promise<string> {
    const moonbitFolder: string = getMoonbitFolder();
    const moonbitExt: string = getMoonbitExt();
    await executeCommand("moon", ["build", "--release", "--target", "js", "--directory", moonbitFolder, "--verbose"]);
    const jsFilePath: string = path.join(moonbitFolder, "target", "js", "release", "build", `${moonbitFilePath.substring(moonbitFolder.length, moonbitFilePath.length - moonbitExt.length)}js`);
    await fse.appendFile(jsFilePath, `// @lc app=leetcode.cn id=${await getNodeIdFromFile(moonbitFilePath)} lang=javascript`);
    return jsFilePath;
}
