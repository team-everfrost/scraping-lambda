export const transformation = {
  patterns: [
    /http(s?):\/\/gall.dcinside.com\/*/,
    /http(s?):\/\/m.dcinside.com\/*/,
  ],
  pre: (document) => {
    console.log('Pre: transformation for gall.dcinside.com is applied.');

    // 본문을 찾습니다.
    const mainArticle = document.querySelector(
      '#container > section:nth-child(1) > article:nth-child(3)',
    );

    // 본문이 존재할 경우
    if (mainArticle) {
      console.log('Pre: Main article is found.');

      // 복제합니다.
      const clonedArticle = mainArticle.cloneNode(true);

      // 본문을 담을 임시 div를 생성합니다.
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(clonedArticle);

      // 원래의 document의 body를 비우고, 임시 div의 내용으로 채웁니다.
      document.body.innerHTML = '';
      document.body.appendChild(tempDiv);
    }
    return document;
  },
  post: (document) => {
    console.log('Post: transformation for gall.dcinside.com is applied.');

    // 본문을 찾습니다.
    const mainArticle = document.querySelector('.writing_view_box');
    const main = document.querySelector('#readability-page-1');

    // 본문이 존재할 경우
    if (mainArticle && main) {
      console.log('Post: Main article is found.');
      // 복제합니다.
      const clonedArticle = mainArticle.cloneNode(true);

      // 본문을 담을 임시 div를 생성합니다.
      const tempDiv = document.createElement('div');
      tempDiv.appendChild(clonedArticle);

      main.innerHTML = '';
      main.appendChild(tempDiv);
    }

    const imgwrap = document.querySelector('.imgwrap');

    if (imgwrap) {
      console.log('Post: imgwrap is found.');
      // imgwarp 를 삭제합니다.
      imgwrap.remove();
    }

    return document;
  },
};
