import {
  EFFECTIVE,
  disclaimer,
  privacy,
  privacyIntro,
  privacyNos,
  terms,
  termsIntro,
  type Section,
} from '../content/legal.ts'

function Sections({ list }: { list: Section[] }) {
  return (
    <>
      {list.map((s) => (
        <section key={s.h}>
          <h2>{s.h}</h2>
          {s.ps.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {s.list && (
            <ul>
              {s.list.map((li) => (
                <li key={li.b}>
                  <b>{li.b}</b> {li.t}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </>
  )
}

export function Terms() {
  return (
    <article className="doc legal">
      <p className="kicker">Legal</p>
      <h1>Terms of Service</h1>
      <p>Effective {EFFECTIVE}.</p>
      <p>{termsIntro}</p>
      <Sections list={terms} />
      <p className="see-also">
        See also the <a href="#/privacy">Privacy Policy</a> and <a href="#/disclaimer">Disclaimer</a>.
      </p>
    </article>
  )
}

export function Privacy() {
  return (
    <article className="doc legal">
      <p className="kicker">Legal</p>
      <h1>Privacy Policy</h1>
      <p>Effective {EFFECTIVE}.</p>
      <p>{privacyIntro}</p>
      <div className="nos">
        {privacyNos.map((n) => (
          <div key={n.k}>
            <b>{n.v}</b>
            <span>{n.k}</span>
          </div>
        ))}
      </div>
      <Sections list={privacy} />
    </article>
  )
}

export function Disclaimer() {
  return (
    <article className="doc legal">
      <p className="kicker">Legal</p>
      <h1>Disclaimer</h1>
      <p>Effective {EFFECTIVE}.</p>
      <div className="callout">
        <b>CryptoFi is software, not a financial service.</b> It does not hold your funds, execute trades on your behalf,
        give advice, or guarantee any outcome. Onchain transactions are final.
      </div>
      <Sections list={disclaimer} />
      <p className="see-also">
        See also the <a href="#/terms">Terms</a> and <a href="#/privacy">Privacy Policy</a>.
      </p>
    </article>
  )
}
