import { EMPTY } from 'rxjs';
import { Action, Selector, State, StateContext, Store } from '@ngxs/store';
import { Injectable } from '@angular/core';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import * as moment from 'moment';
import { Navigate } from '@ngxs/router-plugin';

import { AuthStateModel } from '@store/auth/models/auth-state.model';
import { GetCurrentUser, Login, Logout, SetCurrentUser, SetToken } from '@store/auth/state/auth.actions';
import { AuthService } from '@store/auth/services/auth.service';
import { LocalStorageTokenModel } from '@store/auth/models/local-storage-token.model';
import { AuthConstants } from '@store/auth/enums/auth-constants.enum';
import { registerAuthenticationTimeout } from '@store/auth/initializers/authentication.initializers';
import { CartStateModel } from '@store/cart/models/cart-state.model';
import { DataStateType } from '@core/store';

@State<AuthStateModel>({
  name: 'auth',
  defaults: {
    isLoggedIn: false,
    token: null,
    user: null
  }
})
@Injectable()
export class AuthState {
  @Selector()
  static selectState(state: AuthStateModel) {
    return state;
  }

  @Selector()
  static selectUser({ user }: AuthStateModel) {
    return user;
  }

  @Selector()
  static selectIsLoggedIn({ isLoggedIn }: AuthStateModel) {
    return isLoggedIn;
  }

  constructor(
    private readonly store: Store,
    private readonly authService: AuthService,
  ) {
  }

  @Action(Login)
  dispatchLogin(context: StateContext<AuthStateModel>, { request }: Login) {
    return this.authService.login(request)
      .pipe(
        tap(response => {
          const { token, expiresIn } = response
          const storageToken: LocalStorageTokenModel = { token, expiresAt: moment().unix() + expiresIn }
          localStorage.setItem(AuthConstants.tokenStorageKey, JSON.stringify(storageToken));
          registerAuthenticationTimeout(context, +expiresIn);
          context.patchState({ token, isLoggedIn: true });
        }),
        switchMap(() => this.authService.getCurrentUser()),
        tap(user => {
          context.patchState({ user });
          context.dispatch(new Navigate(['/products']))
        })
      )
  }

  @Action(GetCurrentUser)
  dispatchGetCurrentUser(context: StateContext<AuthStateModel>) {
    return this.authService.getCurrentUser()
      .pipe(
        map(user => context.patchState({ user })),
        catchError(() => {
          context.dispatch(new Logout())
          return EMPTY;
        })
      )
  }

  @Action(SetCurrentUser)
  dispatchSetCurrentUser(context: StateContext<AuthStateModel>, { user }: SetCurrentUser) {
    context.patchState({ user });
  }

  @Action(Logout)
  dispatchLogout(context: StateContext<AuthStateModel>) {
    localStorage.removeItem(AuthConstants.tokenStorageKey);
    this.store.reset({
      ...this.store.snapshot(),
      auth: { isLoggedIn: false, token: null, user: null } as AuthStateModel,
      cart: { data: [], dataState: DataStateType.loadEnd } as CartStateModel,
    })
    context.patchState({ token: null, user: null, isLoggedIn: false });
    context.dispatch(new Navigate(['/']))
  }

  @Action(SetToken)
  dispatchSetToken(context: StateContext<AuthStateModel>, { token }: SetToken) {
    context.patchState({ token: token, isLoggedIn: true })
  }
}
