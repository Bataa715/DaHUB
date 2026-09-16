/**
 * useEffect дотроос async ачаалагчийг эхлүүлнэ.
 *
 * React Compiler-ийн `react-hooks/set-state-in-effect` дүрэм нь эффектээс
 * async функцийг шууд дуудахыг (setState нь `await`-ын ДАРАА байсан ч)
 * "синхрон setState" гэж үздэг. Ачаалагчийг microtask-аар эхлүүлснээр
 * эффектийн биеэс setState огт синхрон дуудагдахгүй нь тодорхой болно.
 *
 * ⚠️ Ачаалагчийн эхэнд (эхний await-аас өмнө) setState бүү бич — loading-ийн
 * анхны утгыг `useState(true)`-ээр, дахин ачаалахыг товчны handler-т тохируул.
 * Алдааг ачаалагч өөрөө барих ёстой; энд зөвхөн unhandled rejection-оос сэргийлнэ.
 */
export function startAsync(run: () => Promise<unknown>): void {
  void Promise.resolve()
    .then(run)
    .catch(() => {});
}
