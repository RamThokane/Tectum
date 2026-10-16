import { Link } from 'react-router-dom';
import { UserPlus, LogOut, X, ArrowLeftRight, Check } from 'lucide-react';
import Avatar from './Avatar';
import { Tick } from './VerificationBadge';
import { PageLoader } from './ui';
import { useSavedAccounts, useSwitchAccount, useForgetAccount, useLogout, useLogoutAll } from '../hooks/useAccounts';
import { MAX_SAVED_ACCOUNTS_HINT } from '../lib/constants';

export default function AccountsSection() {
  const { data: accounts, isPending } = useSavedAccounts();
  const switchTo = useSwitchAccount();
  const forget = useForgetAccount();
  const logout = useLogout();
  const logoutAll = useLogoutAll();

  return (
    <div className="space-y-4">
      <section className="card">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-editorial text-[20px] font-medium leading-[26px]">Switch or manage accounts</h2>
          <p className="muted mt-0.5 text-[13px] leading-[18px]">
            Stay logged in to more than one account on this browser and switch between them in one tap.
          </p>
        </div>

        {isPending ? (
          <PageLoader />
        ) : (
          <ul>
            {accounts.map((a) => (
              <li key={a._id} className="flex items-center gap-3 border-b border-line px-5 py-3.5 last:border-0">
                <Avatar user={a} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate font-semibold">
                    <span className="truncate">{a.name}</span> <Tick user={a} />
                  </p>
                  <p className="muted truncate text-[12px]">{a.email}</p>
                </div>
                {a.current ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-[12px] font-medium text-success">
                    <Check className="h-3.5 w-3.5" /> Current
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <button className="btn-secondary min-h-8 px-3 py-1 text-[13px]" disabled={switchTo.isPending} onClick={() => switchTo.mutate(a._id)}>
                      <ArrowLeftRight className="h-3.5 w-3.5" /> Switch
                    </button>
                    <button
                      className="btn-ghost p-1.5"
                      title="Remove from this browser"
                      aria-label={`Remove ${a.name} from this browser`}
                      onClick={() => window.confirm(`Remove ${a.name} from this browser? You'll need their password to add it again.`) && forget.mutate(a._id)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
          {(accounts?.length ?? 0) < 5 ? (
            <Link to="/login?add=1" className="btn-primary">
              <UserPlus className="h-4 w-4" /> Add another account
            </Link>
          ) : (
            <p className="muted text-[13px]">{MAX_SAVED_ACCOUNTS_HINT}</p>
          )}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="font-editorial text-[20px] font-medium leading-[26px]">Log out</h2>
        <p className="muted mt-0.5 text-[13px] leading-[18px]">
          Logging out of the current account switches you to your next saved account, if there is one.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={logout}>
            <LogOut className="h-4 w-4" /> Log out of this account
          </button>
          {(accounts?.length ?? 0) > 1 && (
            <button className="btn-secondary text-danger" onClick={() => window.confirm('Log out of all accounts on this browser?') && logoutAll()}>
              <LogOut className="h-4 w-4" /> Log out of all accounts
            </button>
          )}
        </div>
        <p className="muted mt-3 text-[12px]">On a shared or public computer, always use "Log out of all accounts" when you're done.</p>
      </section>
    </div>
  );
}
