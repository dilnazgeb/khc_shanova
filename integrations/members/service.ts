import { members } from "@wix/members";
import { Member } from ".";

export const getCurrentMember = async (): Promise<Member | null> => {
  // Dev-mode fallback: return a mock member when running locally
  // (localhost / 127.0.0.1) or when the bundler indicates a dev environment.
  try {
    const isBrowser = typeof window !== 'undefined';
    const isLocalhost = isBrowser && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const isViteDev = typeof import.meta !== 'undefined' && Boolean((import.meta as any).env?.DEV);

    if (isBrowser && (isLocalhost || isViteDev)) {
      const devMember: Member = {
        loginEmail: 'dev@local.example',
        loginEmailVerified: true,
        status: 'APPROVED',
        contact: {
          firstName: 'Dev',
          lastName: 'User',
        },
        profile: {
          nickname: 'DevUser',
          photo: {
            url: undefined,
            height: undefined,
            width: undefined,
            offsetX: undefined,
            offsetY: undefined,
          },
          title: 'Developer',
        },
        _createdDate: new Date(),
        _updatedDate: new Date(),
        lastLoginDate: new Date(),
      };

      console.log('Using mock dev member for local development');
      return devMember;
    }

    const member = await members.getCurrentMember({ fieldsets: ["FULL"] });
    if (!member) {
      console.log('==== No member found');
      return null;
    }
    return member.member;
  } catch (error) {
    console.log(error);
    return null;
  }
};
