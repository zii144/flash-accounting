import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getGoogleNativeRedirectUri,
  getGoogleNativeUrlScheme,
  getGoogleOAuthClientPrefix,
  getGoogleReversedClientId,
} from "../utils/google-oauth";

describe("google-oauth", () => {
  const sampleClientId =
    "329368845776-gqbehbomje9m3flirkt0up3o4q20b2nt.apps.googleusercontent.com";

  it("extracts numeric client prefix", () => {
    assert.equal(getGoogleOAuthClientPrefix(sampleClientId), "329368845776");
  });

  it("builds the full dot-reversed Google client ID", () => {
    assert.equal(
      getGoogleReversedClientId(sampleClientId),
      "com.googleusercontent.apps.329368845776-gqbehbomje9m3flirkt0up3o4q20b2nt"
    );
  });

  it("builds Google native redirect URI", () => {
    assert.equal(
      getGoogleNativeRedirectUri(sampleClientId),
      "com.googleusercontent.apps.329368845776-gqbehbomje9m3flirkt0up3o4q20b2nt:/oauth2redirect"
    );
  });

  it("builds Google native URL scheme for Info.plist", () => {
    assert.equal(
      getGoogleNativeUrlScheme(sampleClientId),
      "com.googleusercontent.apps.329368845776-gqbehbomje9m3flirkt0up3o4q20b2nt"
    );
  });
});
