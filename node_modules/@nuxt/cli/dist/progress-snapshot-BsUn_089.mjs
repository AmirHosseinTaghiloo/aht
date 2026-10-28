//#region src/utils/progress-snapshot.ts
/**
* The message of the phase a command ends in, so a reporter can tell a phase
* label from narration about what the phase is still waiting on.
*/
const READY_MESSAGE = "Ready";
/** Forward-only sequence of phases, timing each as it is left. */
var PhaseTimeline = class {
	timings = [];
	index = 0;
	startedAt = Date.now();
	phaseStartedAt = this.startedAt;
	phases;
	#listeners = /* @__PURE__ */ new Set();
	constructor(phases) {
		this.phases = phases;
	}
	get snapshot() {
		const now = Date.now();
		return {
			status: "loading",
			phase: this.phases[this.index].id,
			message: this.phases[this.index].message,
			index: this.index,
			total: this.phases.length - 1,
			progress: this.index / (this.phases.length - 1),
			elapsed: now - this.startedAt,
			phaseElapsed: now - this.phaseStartedAt,
			reload: false,
			serving: true,
			timings: this.timings
		};
	}
	onUpdate(listener) {
		this.#listeners.add(listener);
		return () => this.#listeners.delete(listener);
	}
	restart() {
		this.index = 0;
		this.timings = [];
		this.startedAt = Date.now();
		this.phaseStartedAt = this.startedAt;
	}
	closePhase() {
		const phase = this.phases[this.index];
		this.timings.push({
			phase: phase.id,
			message: phase.message,
			duration: Date.now() - this.phaseStartedAt
		});
		this.phaseStartedAt = Date.now();
	}
	/** Enter phase `id`; `undefined` if unknown or already passed. */
	enter(id) {
		const index = this.phases.findIndex((phase) => phase.id === id);
		if (index === -1 || index < this.index) return;
		if (index === this.index) return false;
		this.closePhase();
		this.index = index;
		return true;
	}
	emit() {
		const snapshot = this.snapshot;
		for (const listener of this.#listeners) listener(snapshot);
		return snapshot;
	}
};
//#endregion
export { READY_MESSAGE as n, PhaseTimeline as t };
