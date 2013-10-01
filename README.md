# dgraph-stylus

Stylus transform for dgraph.

    % npm install -g dgraph dgraph-stylus css-pack
    % dgraph --transform dgraph-stylus ./styles.styl \
        | css-pack \
        > ./styles.css
