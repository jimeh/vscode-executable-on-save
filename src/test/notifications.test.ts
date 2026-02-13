import * as assert from 'assert';
import * as vscode from 'vscode';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import sinon from 'sinon';
import {
  announceModeChange,
  reportError,
  showErrorMessage,
} from '../notifications';
import { type Config } from '../config';

suite('notifications', () => {
  let sandbox: sinon.SinonSandbox;

  setup(() => {
    sandbox = sinon.createSandbox();
  });

  teardown(() => {
    sandbox.restore();
  });

  suite('showErrorMessage', () => {
    test('shows error when both silent flags are false', async () => {
      const showErrorStub = sandbox
        .stub(vscode.window, 'showErrorMessage')
        .resolves(undefined as unknown as vscode.MessageItem);

      const config: Pick<Config, 'silent' | 'silentErrors'> = {
        silent: false,
        silentErrors: false,
      };
      await showErrorMessage('test error', config);

      sinon.assert.calledOnce(showErrorStub);
      sinon.assert.calledWith(showErrorStub, 'test error');
    });

    test('suppresses error when silentErrors is true', async () => {
      const showErrorStub = sandbox
        .stub(vscode.window, 'showErrorMessage')
        .resolves(undefined as unknown as vscode.MessageItem);

      const config: Pick<Config, 'silent' | 'silentErrors'> = {
        silent: false,
        silentErrors: true,
      };
      await showErrorMessage('test error', config);

      sinon.assert.notCalled(showErrorStub);
    });

    test('suppresses error when silent is true', async () => {
      const showErrorStub = sandbox
        .stub(vscode.window, 'showErrorMessage')
        .resolves(undefined as unknown as vscode.MessageItem);

      const config: Pick<Config, 'silent' | 'silentErrors'> = {
        silent: true,
        silentErrors: false,
      };
      await showErrorMessage('test error', config);

      sinon.assert.notCalled(showErrorStub);
    });
  });

  suite('reportError', () => {
    let tempDir: string;
    let fileUri: vscode.Uri;
    let document: vscode.TextDocument;

    setup(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'notif-test-'));
      fileUri = vscode.Uri.file(join(tempDir, 'test-file.sh'));
      await writeFile(fileUri.fsPath, '#!/bin/bash\necho test\n', {
        mode: 0o644,
      });
      document = await vscode.workspace.openTextDocument(fileUri);
    });

    teardown(async () => {
      await rm(tempDir, { force: true, recursive: true });
    });

    test('handles EACCES error with proper message', async () => {
      const showErrorStub = sandbox
        .stub(vscode.window, 'showErrorMessage')
        .resolves(undefined as unknown as vscode.MessageItem);

      const error = { code: 'EACCES' };
      const config: Pick<Config, 'silent' | 'silentErrors'> = {
        silent: false,
        silentErrors: false,
      };

      await reportError(document, error, config);

      sinon.assert.calledOnce(showErrorStub);
      assert.ok(showErrorStub.firstCall.args[0].includes('Permission denied'));
      assert.ok(showErrorStub.firstCall.args[0].includes('test-file.sh'));
    });

    test('handles ENOENT error with proper message', async () => {
      const showErrorStub = sandbox
        .stub(vscode.window, 'showErrorMessage')
        .resolves(undefined as unknown as vscode.MessageItem);

      const error = { code: 'ENOENT' };
      const config: Pick<Config, 'silent' | 'silentErrors'> = {
        silent: false,
        silentErrors: false,
      };

      await reportError(document, error, config);

      sinon.assert.calledOnce(showErrorStub);
      assert.ok(showErrorStub.firstCall.args[0].includes('no longer exists'));
      assert.ok(showErrorStub.firstCall.args[0].includes('test-file.sh'));
    });

    test('handles generic Error with message', async () => {
      const showErrorStub = sandbox
        .stub(vscode.window, 'showErrorMessage')
        .resolves(undefined as unknown as vscode.MessageItem);

      const error = new Error('Something went wrong');
      const config: Pick<Config, 'silent' | 'silentErrors'> = {
        silent: false,
        silentErrors: false,
      };

      await reportError(document, error, config);

      sinon.assert.calledOnce(showErrorStub);
      assert.ok(
        showErrorStub.firstCall.args[0].includes('Something went wrong')
      );
      assert.ok(showErrorStub.firstCall.args[0].includes('test-file.sh'));
    });

    test('handles non-Error object', async () => {
      const showErrorStub = sandbox
        .stub(vscode.window, 'showErrorMessage')
        .resolves(undefined as unknown as vscode.MessageItem);

      const error = 'string error';
      const config: Pick<Config, 'silent' | 'silentErrors'> = {
        silent: false,
        silentErrors: false,
      };

      await reportError(document, error, config);

      sinon.assert.calledOnce(showErrorStub);
      assert.ok(showErrorStub.firstCall.args[0].includes('string error'));
    });

    test('respects silentErrors config', async () => {
      const showErrorStub = sandbox
        .stub(vscode.window, 'showErrorMessage')
        .resolves(undefined as unknown as vscode.MessageItem);

      const error = { code: 'EACCES' };
      const config: Pick<Config, 'silent' | 'silentErrors'> = {
        silent: false,
        silentErrors: true,
      };

      await reportError(document, error, config);

      // Logs to console but doesn't show UI
      sinon.assert.notCalled(showErrorStub);
    });
  });

  suite('announceModeChange', () => {
    let tempDir: string;
    let fileUri: vscode.Uri;
    let document: vscode.TextDocument;

    setup(async () => {
      tempDir = await mkdtemp(join(tmpdir(), 'notif-test-'));
      fileUri = vscode.Uri.file(join(tempDir, 'test-script.sh'));
      await writeFile(fileUri.fsPath, '#!/bin/bash\necho test\n', {
        mode: 0o644,
      });
      document = await vscode.workspace.openTextDocument(fileUri);
    });

    teardown(async () => {
      await rm(tempDir, { force: true, recursive: true });
    });

    test('shows info message with correct format', async () => {
      const showInfoStub = sandbox
        .stub(vscode.window, 'showInformationMessage')
        .resolves(undefined as unknown as vscode.MessageItem);

      await announceModeChange(document, 0o644, 0o755);

      sinon.assert.calledOnce(showInfoStub);
      const message = showInfoStub.firstCall.args[0];
      assert.ok(message.includes('Made executable'));
      assert.ok(message.includes('644'));
      assert.ok(message.includes('755'));
      assert.ok(message.includes('test-script.sh'));
    });

    test('formats mode with leading zeros', async () => {
      const showInfoStub = sandbox
        .stub(vscode.window, 'showInformationMessage')
        .resolves(undefined as unknown as vscode.MessageItem);

      await announceModeChange(document, 0o004, 0o005);

      sinon.assert.calledOnce(showInfoStub);
      const message = showInfoStub.firstCall.args[0];
      assert.ok(message.includes('004'));
      assert.ok(message.includes('005'));
    });
  });
});
