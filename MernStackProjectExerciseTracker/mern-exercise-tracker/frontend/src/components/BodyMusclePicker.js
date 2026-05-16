import { useMemo, useState } from "react";

const allMuscleParts = [
  {
    view: "front",
    id: "pectorals major",
    label: "Pectorals major",
    color: "#c76f78",
    labelPosition: { x: 14, y: 104, anchor: "start" },
    line: "M112 102 L56 98",
    shape: (
      <>
        <path d="M129 96 C144 88 170 95 174 116 C166 131 140 130 124 118 C121 110 123 101 129 96 Z" />
        <path d="M231 96 C216 88 190 95 186 116 C194 131 220 130 236 118 C239 110 237 101 231 96 Z" />
      </>
    )
  },
  {
    view: "front",
    id: "trapezius",
    label: "Trapezius",
    color: "#8b0f1e",
    labelPosition: { x: 346, y: 69, anchor: "end" },
    line: "M207 75 L300 64",
    shape: (
      <path d="M151 70 L130 91 L151 101 L180 88 L209 101 L230 91 L209 70 L196 75 L180 83 L164 75 Z" />
    )
  },
  {
    view: "front",
    id: "deltoids",
    label: "Deltoid",
    color: "#d95f18",
    labelPosition: { x: 346, y: 94, anchor: "end" },
    line: "M236 106 L300 90",
    shape: (
      <>
        <path d="M121 91 C103 94 88 106 84 126 C100 132 118 122 130 105 C129 99 126 94 121 91 Z" />
        <path d="M239 91 C257 94 272 106 276 126 C260 132 242 122 230 105 C231 99 234 94 239 91 Z" />
      </>
    )
  },
  {
    view: "front",
    id: "biceps",
    label: "Biceps",
    color: "#c7a533",
    labelPosition: { x: 14, y: 132, anchor: "start" },
    line: "M101 143 L58 128",
    shape: (
      <>
        <path d="M87 128 C103 130 113 142 111 163 L103 197 C99 208 85 205 81 194 L83 151 C84 141 85 134 87 128 Z" />
        <path d="M273 128 C257 130 247 142 249 163 L257 197 C261 208 275 205 279 194 L277 151 C276 141 275 134 273 128 Z" />
      </>
    )
  },
  {
    view: "front",
    id: "abdominals",
    label: "Abdominals",
    color: "#7f8d16",
    labelPosition: { x: 14, y: 159, anchor: "start" },
    line: "M160 154 L72 155",
    shape: (
      <>
        <path d="M147 126 C156 120 204 120 213 126 L205 194 C199 205 161 205 155 194 Z" />
        <rect x="158" y="132" width="18" height="18" rx="5" />
        <rect x="184" y="132" width="18" height="18" rx="5" />
        <rect x="156" y="154" width="20" height="18" rx="5" />
        <rect x="184" y="154" width="20" height="18" rx="5" />
        <rect x="156" y="176" width="20" height="20" rx="5" />
        <rect x="184" y="176" width="20" height="20" rx="5" />
      </>
    )
  },
  {
    view: "front",
    id: "external obliques",
    label: "External oblique",
    color: "#9a8d22",
    labelPosition: { x: 346, y: 148, anchor: "end" },
    line: "M218 154 L286 145",
    shape: (
      <>
        <path d="M126 121 C138 128 145 148 144 178 L134 198 C124 184 119 158 122 137 Z" />
        <path d="M234 121 C222 128 215 148 216 178 L226 198 C236 184 241 158 238 137 Z" />
      </>
    )
  },
  {
    view: "front",
    id: "brachioradialis",
    label: "Brachioradialis",
    color: "#74b95d",
    labelPosition: { x: 346, y: 197, anchor: "end" },
    line: "M264 220 L286 193",
    shape: (
      <>
        <path d="M82 197 C96 204 101 220 96 242 L87 278 C78 277 74 267 77 253 L78 221 C78 212 79 204 82 197 Z" />
        <path d="M278 197 C264 204 259 220 264 242 L273 278 C282 277 286 267 283 253 L282 221 C282 212 281 204 278 197 Z" />
      </>
    )
  },
  {
    view: "front",
    id: "sartorius",
    label: "Sartorius",
    color: "#8fd6e7",
    labelPosition: { x: 14, y: 273, anchor: "start" },
    line: "M147 282 L62 270",
    shape: (
      <>
        <path d="M148 227 C153 232 157 238 158 245 C145 265 137 290 132 319 C127 318 122 315 119 311 C124 279 133 251 148 227 Z" />
        <path d="M212 227 C207 232 203 238 202 245 C215 265 223 290 228 319 C233 318 238 315 241 311 C236 279 227 251 212 227 Z" />
      </>
    )
  },
  {
    view: "front",
    id: "abductors",
    label: "Abductors",
    color: "#285f92",
    labelPosition: { x: 14, y: 298, anchor: "start" },
    line: "M163 276 L66 296",
    shape: (
      <>
        <path d="M164 217 C171 230 174 250 171 274 L158 332 C145 318 142 282 147 247 C151 235 156 225 164 217 Z" />
        <path d="M196 217 C189 230 186 250 189 274 L202 332 C215 318 218 282 213 247 C209 235 204 225 196 217 Z" />
      </>
    )
  },
  {
    view: "front",
    id: "quadriceps",
    label: "Quadriceps",
    color: "#4595be",
    labelPosition: { x: 346, y: 268, anchor: "end" },
    line: "M210 270 L296 265",
    shape: (
      <>
        <path d="M134 220 C151 219 163 231 165 251 L158 331 C145 338 129 333 122 318 L122 264 C123 245 127 230 134 220 Z" />
        <path d="M226 220 C209 219 197 231 195 251 L202 331 C215 338 231 333 238 318 L238 264 C237 245 233 230 226 220 Z" />
      </>
    )
  },
  {
    view: "front",
    id: "tibialis anterior",
    label: "Tibialis anterior",
    color: "#8b3f8f",
    labelPosition: { x: 346, y: 326, anchor: "end" },
    line: "M210 334 L282 322",
    shape: (
      <>
        <path d="M132 326 C144 333 149 350 145 381 C139 388 128 388 124 378 C125 354 127 338 132 326 Z" />
        <path d="M228 326 C216 333 211 350 215 381 C221 388 232 388 236 378 C235 354 233 338 228 326 Z" />
      </>
    )
  },
  {
    view: "front",
    id: "gastrocnemius",
    label: "Gastrocnemius",
    color: "#bb3b86",
    labelPosition: { x: 346, y: 354, anchor: "end" },
    line: "M222 370 L284 350",
    shape: (
      <>
        <path d="M147 326 C155 342 154 364 146 387 C139 395 125 391 124 379 C126 357 132 338 147 326 Z" />
        <path d="M213 326 C205 342 206 364 214 387 C221 395 235 391 236 379 C234 357 228 338 213 326 Z" />
      </>
    )
  },
  {
    view: "back",
    id: "trapezius",
    label: "Trapezius",
    color: "#8b0f1e",
    labelPosition: { x: 14, y: 72, anchor: "start" },
    line: "M178 90 L64 68",
    shape: (
      <path d="M154 70 C161 84 169 96 180 104 C191 96 199 84 206 70 L222 97 L204 152 L180 168 L156 152 L138 97 Z" />
    )
  },
  {
    view: "back",
    id: "deltoids",
    label: "Deltoid",
    color: "#d95f18",
    labelPosition: { x: 346, y: 91, anchor: "end" },
    line: "M238 106 L300 86",
    shape: (
      <>
        <path d="M121 91 C102 96 89 109 84 130 C102 132 119 122 130 106 C129 99 126 94 121 91 Z" />
        <path d="M239 91 C258 96 271 109 276 130 C258 132 241 122 230 106 C231 99 234 94 239 91 Z" />
      </>
    )
  },
  {
    view: "back",
    id: "infraspinatus",
    label: "Infraspinatus",
    color: "#e7b52b",
    labelPosition: { x: 346, y: 120, anchor: "end" },
    line: "M213 126 L292 116",
    shape: (
      <>
        <path d="M137 105 C152 105 166 113 175 126 C162 139 142 140 127 128 Z" />
        <path d="M223 105 C208 105 194 113 185 126 C198 139 218 140 233 128 Z" />
      </>
    )
  },
  {
    view: "back",
    id: "teres major",
    label: "Teres major",
    color: "#f0ca35",
    labelPosition: { x: 346, y: 146, anchor: "end" },
    line: "M222 144 L294 142",
    shape: (
      <>
        <path d="M125 131 C141 136 153 146 161 158 C145 163 130 156 119 143 Z" />
        <path d="M235 131 C219 136 207 146 199 158 C215 163 230 156 241 143 Z" />
      </>
    )
  },
  {
    view: "back",
    id: "latissimus dorsi",
    label: "Latissimus dorsi",
    color: "#d49315",
    labelPosition: { x: 14, y: 145, anchor: "start" },
    line: "M145 160 L70 140",
    shape: (
      <>
        <path d="M126 128 C150 143 164 164 169 199 L143 219 C130 197 120 167 118 142 Z" />
        <path d="M234 128 C210 143 196 164 191 199 L217 219 C230 197 240 167 242 142 Z" />
      </>
    )
  },
  {
    view: "back",
    id: "triceps",
    label: "Triceps",
    color: "#9d8a56",
    labelPosition: { x: 346, y: 176, anchor: "end" },
    line: "M257 166 L300 172",
    shape: (
      <>
        <path d="M87 130 C103 132 112 145 111 166 L103 200 C99 211 85 208 81 196 L83 151 C84 142 85 135 87 130 Z" />
        <path d="M273 130 C257 132 248 145 249 166 L257 200 C261 211 275 208 279 196 L277 151 C276 142 275 135 273 130 Z" />
      </>
    )
  },
  {
    view: "back",
    id: "finger extensors",
    label: "Finger extensors",
    color: "#64b66a",
    labelPosition: { x: 14, y: 213, anchor: "start" },
    line: "M96 229 L70 210",
    shape: (
      <>
        <path d="M82 199 C96 206 101 222 96 246 L88 278 C78 278 74 268 77 254 L78 222 C78 213 79 205 82 199 Z" />
        <path d="M278 199 C264 206 259 222 264 246 L272 278 C282 278 286 268 283 254 L282 222 C282 213 281 205 278 199 Z" />
      </>
    )
  },
  {
    view: "back",
    id: "gluteus medius",
    label: "Gluteus medius",
    color: "#6bb2c4",
    labelPosition: { x: 346, y: 239, anchor: "end" },
    line: "M207 224 L292 235",
    shape: (
      <>
        <path d="M145 205 C158 200 174 205 178 219 C165 229 150 227 138 218 Z" />
        <path d="M215 205 C202 200 186 205 182 219 C195 229 210 227 222 218 Z" />
      </>
    )
  },
  {
    view: "back",
    id: "gluteus maximus",
    label: "Gluteus maximus",
    color: "#5ba7b5",
    labelPosition: { x: 346, y: 265, anchor: "end" },
    line: "M210 246 L292 260",
    shape: (
      <>
        <path d="M134 220 C153 214 174 223 177 244 C164 259 140 260 127 246 C126 236 129 227 134 220 Z" />
        <path d="M226 220 C207 214 186 223 183 244 C196 259 220 260 233 246 C234 236 231 227 226 220 Z" />
      </>
    )
  },
  {
    view: "back",
    id: "hamstrings",
    label: "Hamstrings",
    color: "#625fa8",
    labelPosition: { x: 14, y: 289, anchor: "start" },
    line: "M145 293 L72 285",
    shape: (
      <>
        <path d="M130 250 C151 248 164 263 163 286 L155 342 C143 353 125 348 121 331 L121 283 C122 269 125 258 130 250 Z" />
        <path d="M230 250 C209 248 196 263 197 286 L205 342 C217 353 235 348 239 331 L239 283 C238 269 235 258 230 250 Z" />
      </>
    )
  },
  {
    view: "back",
    id: "gastrocnemius",
    label: "Gastrocnemius",
    color: "#4f3a91",
    labelPosition: { x: 14, y: 344, anchor: "start" },
    line: "M145 356 L72 340",
    shape: (
      <>
        <path d="M129 338 C145 333 155 346 153 371 C148 390 128 391 123 374 C123 359 125 347 129 338 Z" />
        <path d="M231 338 C215 333 205 346 207 371 C212 390 232 391 237 374 C237 359 235 347 231 338 Z" />
      </>
    )
  },
  {
    view: "back",
    id: "soleus",
    label: "Soleus",
    color: "#7f3c9d",
    labelPosition: { x: 14, y: 370, anchor: "start" },
    line: "M140 385 L72 366",
    shape: (
      <>
        <path d="M145 366 C153 378 151 391 142 402 C134 405 126 398 127 387 C130 379 136 372 145 366 Z" />
        <path d="M215 366 C207 378 209 391 218 402 C226 405 234 398 233 387 C230 379 224 372 215 366 Z" />
      </>
    )
  }
];

function FrontBodyBase() {
  return (
    <g fill="#fee2d5" stroke="#efbcae" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <ellipse cx="180" cy="43" rx="24" ry="29" />
      <path d="M158 70 C152 82 139 88 121 91 C104 94 90 106 84 128 L73 206 C71 220 82 225 88 214 L101 158 C106 139 113 129 124 124 L134 194 C137 208 149 218 162 223 L151 254 L135 390 C134 401 148 405 153 393 L174 263 L186 263 L207 393 C212 405 226 401 225 390 L209 254 L198 223 C211 218 223 208 226 194 L236 124 C247 129 254 139 259 158 L272 214 C278 225 289 220 287 206 L276 128 C270 106 256 94 239 91 C221 88 208 82 202 70 C190 78 170 78 158 70 Z" />
      <path d="M92 277 C82 289 80 309 87 321" fill="none" />
      <path d="M268 277 C278 289 280 309 273 321" fill="none" />
    </g>
  );
}

function BackBodyBase() {
  return (
    <g fill="#fee2d5" stroke="#efbcae" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2">
      <ellipse cx="180" cy="43" rx="24" ry="29" />
      <path d="M158 70 C152 82 139 88 121 91 C104 94 90 106 84 128 L73 206 C71 220 82 225 88 214 L101 158 C106 139 113 129 124 124 L134 196 C136 208 148 218 162 224 L151 254 L135 390 C134 401 148 405 153 393 L174 263 L186 263 L207 393 C212 405 226 401 225 390 L209 254 L198 224 C212 218 224 208 226 196 L236 124 C247 129 254 139 259 158 L272 214 C278 225 289 220 287 206 L276 128 C270 106 256 94 239 91 C221 88 208 82 202 70 C190 78 170 78 158 70 Z" />
      <path d="M157 72 C168 78 192 78 203 72" fill="none" />
    </g>
  );
}

function BodyMusclePicker({ selectedMuscle, onSelectMuscle, disabled }) {
  const [view, setView] = useState("front");
  const parts = useMemo(() => allMuscleParts.filter((part) => part.view === view), [view]);
  const selectedPart = allMuscleParts.find((part) => part.id === selectedMuscle);

  const handleSelect = (muscleId) => {
    if (!disabled) {
      onSelectMuscle(muscleId);
    }
  };

  return (
    <div className="mt-3 rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          Train by body part
        </p>

        <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          {["front", "back"].map((viewName) => (
            <button
              key={viewName}
              type="button"
              disabled={disabled}
              onClick={() => setView(viewName)}
              className={`rounded-xl px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] transition ${
                view === viewName
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              {viewName}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-white px-2 py-3 shadow-inner">
        <svg
          viewBox="0 0 360 420"
          className="mx-auto block h-auto w-full max-w-[320px]"
          role="img"
          aria-label={`${view} interactive body muscle map`}
        >
          <rect x="0" y="0" width="360" height="420" rx="24" fill="#ffffff" />
          {view === "front" ? <FrontBodyBase /> : <BackBodyBase />}

          {parts.map((part) => {
            const isSelected = selectedMuscle === part.id;
            const labelStroke = isSelected ? "#0891b2" : "#94a3b8";

            return (
              <g
                key={part.id}
                role="button"
                tabIndex={disabled ? -1 : 0}
                aria-label={`Select ${part.label}`}
                onClick={() => handleSelect(part.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelect(part.id);
                  }
                }}
                style={{ cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.58 : 1 }}
              >
                <g
                  fill={part.color}
                  stroke={isSelected ? "#06b6d4" : "rgba(15, 23, 42, 0.22)"}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeWidth={isSelected ? "3.5" : "1.5"}
                >
                  {part.shape}
                </g>
                <path d={part.line} fill="none" stroke={labelStroke} strokeWidth={isSelected ? "2" : "1.25"} />
                <text
                  x={part.labelPosition.x}
                  y={part.labelPosition.y}
                  textAnchor={part.labelPosition.anchor}
                  fontSize="10"
                  fontWeight="800"
                  fill={isSelected ? "#0e7490" : "#475569"}
                  style={{ userSelect: "none" }}
                >
                  {part.label}
                </text>
                <title>{part.label}</title>
              </g>
            );
          })}
        </svg>
      </div>

      {selectedPart && (
        <p className="mt-3 rounded-2xl bg-cyan-50 px-3 py-2 text-center text-xs font-black uppercase tracking-[0.14em] text-cyan-700">
          Selected: {selectedPart.label}
        </p>
      )}
    </div>
  );
}

export default BodyMusclePicker;
