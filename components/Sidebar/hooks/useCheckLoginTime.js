import { useEffect } from "react";
import { getTokenTime, getUserInput, removeTokenTime } from "../../../public/storage";

export const useCheckLoginTime = (setUserInput) => {
  useEffect(() => {
    const isTokenExpired = (tokenTime) => {
      const thirtyDaysInMs = 60 * 24 * 60 * 60 * 1000;
      const now = new Date().getTime();
      return now - tokenTime >= thirtyDaysInMs;
    };

    const fetchLoginTime = async () => {
      const token = await getUserInput();
      const tokenTime = await getTokenTime(token);

      if (isTokenExpired(tokenTime)) {
        await removeTokenTime();
        setUserInput(null);
      }
    };

    fetchLoginTime();
  }, []);
};
