// ─────────────────────────────────────────────
// KAIROS — Investigation Engine Verification Page
//
// Developer tool only. No production use.
//
// Exercises:
//   Disease → Patient → Encounter → Hospital Session
//   → Order Investigations → Resolve Results
//   → Kinetic profile behaviour (troponin over time)
//   → Error path verification
//
// Hospital Engine integration note:
//   This page calls resolveInvestigation and displays
//   reports directly. It does NOT write results back
//   into HospitalState (recordInvestigationResult is
//   a Phase 4 Hospital Engine patch — not yet implemented).
//
// Server component. All resolution happens at render time.
// ─────────────────────────────────────────────

import { DiseaseRegistry }      from "../../lib/data/diseases";
import { generatePatientCase }  from "../../lib/engines/patient";
import { generateEncounter }    from "../../lib/engines/encounter";
import { Severity }             from "../../lib/types/enums";
import {
  createSession,
  applyAction,
}                               from "../../lib/engines/hospital";
import {
  resolveInvestigation,
  computeHoursAfterEvent,
  resolveSeverityTier,
}                               from "../../lib/engines/investigation";
import type {
  InvestigationContext,
  ResolvedFinding,
  ResolutionResult,
}                               from "../../lib/engines/investigation";
import type { HospitalState }   from "../../lib/engines/hospital";
import { notFound }             from "next/navigation";

// ─── Display Helpers ──────────────────────────

function ResultSection({ label, result }: {
  label:  string;
  result: ResolutionResult;
}) {
  if (!result.ok) {
    return (
      <div style={{ marginBottom: "2rem" }}>
        <h3>{label}</h3>
        <p style={{ color: "red" }}>
          ✗ {result.error.kind}: {result.error.message}
        </p>
      </div>
    );
  }

  const { report } = result;

  return (
    <div style={{ marginBottom: "2rem" }}>
      <h3>{label}</h3>
      <table>
        <tbody>
          <tr>
            <td style={{ paddingRight: "1rem" }}><strong>Investigation</strong></td>
            <td>{report.name} ({report.investigationId})</td>
          </tr>
          <tr>
            <td><strong>Type</strong></td>
            <td>{report.type}</td>
          </tr>
          <tr>
            <td><strong>Resolved At</strong></td>
            <td>{report.resolvedAt} clinical minutes</td>
          </tr>
          <tr>
            <td><strong>Severity Tier</strong></td>
            <td style={{ fontWeight: "bold", color: report.resolvedSeverityTier === "normal" ? "green" : "red" }}>
              {report.resolvedSeverityTier}
            </td>
          </tr>
        </tbody>
      </table>

      {report.findings.length > 0 && (
        <>
          <h4>Findings</h4>
          <table border={1} cellPadding={6} style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Kind</th>
                <th>Value / Interpretation</th>
                <th>Unit</th>
                <th>Abnormal</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {report.findings.map((f: ResolvedFinding, i) => (
                <tr key={i} style={{ background: f.kind === "quantitative" && f.isAbnormal ? "#fff0f0" : "white" }}>
                  <td>{f.parameter}</td>
                  <td>{f.kind}</td>
                  <td>
                    {f.kind === "quantitative"
                      ? f.value
                      : f.interpretation}
                  </td>
                  <td>{f.unit}</td>
                  <td>
                    {f.kind === "quantitative"
                      ? (f.isAbnormal ? "🚩 Yes" : "No")
                      : "—"}
                  </td>
                  <td>
                    {f.kind === "quantitative"
                      ? `${f.referenceMin}–${f.referenceMax}`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {report.ecgFindings.length > 0 && (
        <>
          <h4>ECG Findings</h4>
          <table border={1} cellPadding={6} style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Leads</th>
                <th>Finding</th>
                <th>Interpretation</th>
                <th>Importance</th>
              </tr>
            </thead>
            <tbody>
              {report.ecgFindings.map((f, i) => (
                <tr key={i}>
                  <td>{f.leads.join(", ")}</td>
                  <td>{f.finding}</td>
                  <td>{f.interpretation}</td>
                  <td>{f.clinicalImportance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {report.redFlagFindings.length > 0 && (
        <>
          <h4>Red Flag Findings</h4>
          <ul>
            {report.redFlagFindings.map((r, i) => (
              <li key={i} style={{ color: "red" }}>{r}</li>
            ))}
          </ul>
        </>
      )}

      {report.serialTestingAdvisory?.required && (
        <>
          <h4>Serial Testing Advisory</h4>
          <ul>
            {report.serialTestingAdvisory.reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ─── Utility: advance clinical time ──────────

function advanceTime(state: HospitalState, actions: number): HospitalState {
  let s = state;
  for (let i = 0; i < actions; i++) {
    s = applyAction(s, { type: "COMPLETE_ACTION", action: "Take History" });
  }
  return s;
}

// ─── Page ─────────────────────────────────────

export default function TestInvestigationPage() {

  // Developer-only diagnostic route. Never served in production builds.
  if (process.env.NODE_ENV === "production") notFound();

  // ── Pipeline Setup ────────────────────────
  const disease = DiseaseRegistry.getById("stemi");
  if (!disease) return <p>STEMI not found in DiseaseRegistry.</p>;

  const patientCase = generatePatientCase(disease, Severity.Moderate, 12345);
  const encounter   = generateEncounter(patientCase);
  const session     = createSession(encounter);

  // ── Order investigations ──────────────────
  // ECG and Troponin at clinical minute 0
  const state0 = session.state;
  const state1 = applyAction(state0, { type: "ORDER_INVESTIGATION", investigationId: "ecg_12lead" });
  const state2 = applyAction(state1, { type: "ORDER_INVESTIGATION", investigationId: "troponin_i" });

  // ── Base context at minute 0 ──────────────
  const context0: InvestigationContext = {
    patientCase,
    clinicalMinutes: state2.timeState.elapsedClinicalMinutes,
    disease,
  };

  // ── Kinetics verification ─────────────────
  // Take History costs 10 clinical minutes each.
  // 12 actions = 120 clinical minutes = 2 clinical hours.
  // symptomOnsetHours + 2h should push troponin past rise onset.
  const state3 = advanceTime(state2, 12);

  const contextAdvanced: InvestigationContext = {
    patientCase,
    clinicalMinutes: state3.timeState.elapsedClinicalMinutes,
    disease,
  };

  // ── Kinetics calculation display ──────────
  const hoursAt0       = computeHoursAfterEvent(patientCase.symptomOnsetHours, state2.timeState.elapsedClinicalMinutes);
  const hoursAdvanced  = computeHoursAfterEvent(patientCase.symptomOnsetHours, state3.timeState.elapsedClinicalMinutes);
  const troponinDef    = disease.investigations.find(i => i.id === "troponin_i");
  const tierAt0        = troponinDef ? resolveSeverityTier(troponinDef, hoursAt0, patientCase.hidden.chosenSeverity) : "unknown";
  const tierAdvanced   = troponinDef ? resolveSeverityTier(troponinDef, hoursAdvanced, patientCase.hidden.chosenSeverity) : "unknown";

  // ── Resolve at minute 0 ───────────────────
  const ecgResult      = resolveInvestigation("ecg_12lead",  context0, state2);
  const tropAt0        = resolveInvestigation("troponin_i",  context0, state2);

  // ── Resolve after advancing time ──────────
  // Troponin order is still in state3 (applyAction preserves orderedInvestigations)
  const tropAdvanced   = resolveInvestigation("troponin_i", contextAdvanced, state3);

  // ── Error paths ───────────────────────────
  // ORDER_NOT_FOUND — request result for an investigation never ordered
  const errNotOrdered  = resolveInvestigation("chest_xray", context0, state2);

  // INVESTIGATION_NOT_FOUND — order exists but ID not in disease data
  // Simulate by adding a fake order manually to the state
  const stateWithFake  = applyAction(state2, { type: "ORDER_INVESTIGATION", investigationId: "nonexistent_test" });
  const ctxFake: InvestigationContext = { patientCase, clinicalMinutes: stateWithFake.timeState.elapsedClinicalMinutes, disease };
  const errNotInDisease = resolveInvestigation("nonexistent_test", ctxFake, stateWithFake);

  return (
    <html>
      <body style={{ fontFamily: "monospace", padding: "2rem", lineHeight: 1.8, maxWidth: "1100px" }}>

        <h1>Kairos — Investigation Engine Verification</h1>
        <hr />

        {/* ── Patient context ── */}
        <h2>1. Patient Context</h2>
        <table>
          <tbody>
            <tr><td style={{ paddingRight: "1rem" }}><strong>Name</strong></td><td>{patientCase.profile.fullName}</td></tr>
            <tr><td><strong>Age / Sex</strong></td><td>{patientCase.profile.age} / {patientCase.profile.sex}</td></tr>
            <tr><td><strong>Disease Severity (hidden)</strong></td><td>{patientCase.hidden.chosenSeverity}</td></tr>
            <tr><td><strong>Infarct Location (hidden)</strong></td><td>{patientCase.hidden.selectedInfarctLocation ?? "not determined"}</td></tr>
            <tr><td><strong>Symptom Onset Hours</strong></td><td>{patientCase.symptomOnsetHours}h before presentation</td></tr>
            <tr><td><strong>Triage Priority</strong></td><td>{encounter.triagePriority.toUpperCase()}</td></tr>
          </tbody>
        </table>

        {/* ── Kinetics verification ── */}
        <h2>2. Kinetics Verification — Troponin I</h2>
        <table border={1} cellPadding={6} style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>Point</th>
              <th>Clinical Minutes</th>
              <th>Total Hours After Event</th>
              <th>Expected Tier</th>
              <th>Resolved Tier</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>At minute {state2.timeState.elapsedClinicalMinutes}</td>
              <td>{state2.timeState.elapsedClinicalMinutes}</td>
              <td>{hoursAt0.toFixed(2)}h</td>
              <td>{tierAt0}</td>
              <td style={{ color: tropAt0.ok ? "blue" : "red" }}>
                {tropAt0.ok ? tropAt0.report.resolvedSeverityTier : tropAt0.error.kind}
              </td>
            </tr>
            <tr>
              <td>At minute {state3.timeState.elapsedClinicalMinutes}</td>
              <td>{state3.timeState.elapsedClinicalMinutes}</td>
              <td>{hoursAdvanced.toFixed(2)}h</td>
              <td>{tierAdvanced}</td>
              <td style={{ color: tropAdvanced.ok ? "blue" : "red" }}>
                {tropAdvanced.ok ? tropAdvanced.report.resolvedSeverityTier : tropAdvanced.error.kind}
              </td>
            </tr>
          </tbody>
        </table>

        {troponinDef?.kineticProfile && (
          <p style={{ color: "#666" }}>
            Rise onset window: {troponinDef.kineticProfile.riseOnset.hoursAfterEvent.min}–
            {troponinDef.kineticProfile.riseOnset.hoursAfterEvent.max}h after event. &nbsp;
            Normalises after: {troponinDef.kineticProfile.normalises.hoursAfterEvent.min}h.
          </p>
        )}

        {/* ── ECG at minute 0 ── */}
        <h2>3. Investigation Results at Minute {state2.timeState.elapsedClinicalMinutes}</h2>
        <ResultSection label="12-Lead ECG" result={ecgResult} />
        <ResultSection label="Troponin I (early)" result={tropAt0} />

        {/* ── Troponin after time advances ── */}
        <h2>4. Troponin I at Minute {state3.timeState.elapsedClinicalMinutes}</h2>
        <ResultSection label="Troponin I (after advancing time)" result={tropAdvanced} />

        {/* ── Error paths ── */}
        <h2>5. Error Path Verification</h2>
        <ResultSection label="ORDER_NOT_FOUND (chest_xray never ordered)" result={errNotOrdered} />
        <ResultSection label="INVESTIGATION_NOT_FOUND (nonexistent_test not in disease)" result={errNotInDisease} />

        {/* ── Hospital Engine note ── */}
        <h2>6. Integration Note</h2>
        <p>
          <strong>Hospital Engine patch status:</strong>{" "}
          <span style={{ color: "orange" }}>Deferred to Phase 4.</span>
        </p>
        <p>
          This page calls <code>resolveInvestigation()</code> and reads the report directly.
          In production, the Simulation Controller will map <code>InvestigationReport</code> to
          Hospital Engine&apos;s <code>ResolvedInvestigation</code> type and persist it via
          <code> recordInvestigationResult(state, resolved)</code>.
          These Hospital Engine additions are not yet implemented.
        </p>

        <hr />
        <p>
          <strong>Ordered investigations:</strong>{" "}
          {state2.orderedInvestigations.map(o => o.investigationId).join(", ")}
        </p>
        <p>
          <strong>Clinical minutes at initial resolution:</strong>{" "}
          {context0.clinicalMinutes} min
        </p>
        <p>
          <strong>Clinical minutes at advanced resolution:</strong>{" "}
          {contextAdvanced.clinicalMinutes} min
        </p>

      </body>
    </html>
  );
}
